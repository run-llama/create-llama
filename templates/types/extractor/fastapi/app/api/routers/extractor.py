import logging
import os

from fastapi import APIRouter, HTTPException
from llama_index.core.settings import Settings
from pydantic import BaseModel

from app.api.routers.output import Output
from app.engine.index import get_index

extractor_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


class RequestData(BaseModel):
    query: str

    class Config:
        json_schema_extra = {
            "examples": [
                {"query": "What's the maximum weight for a parcel?"},
            ],
        }


@r.post("/query")
async def query_request(
    data: RequestData,
):
    # Create a query engine using that returns responses in the format of the Output class
    query_engine = get_query_engine(Output)

    response = await query_engine.aquery(data.query)

    output_data = response.response.dict()
    return Output(**output_data)


def get_query_engine(output_cls: BaseModel):
    top_k = os.getenv("TOP_K", 3)

    index = get_index()
    if index is None:
        raise HTTPException(
            status_code=500,
            detail=str(
                "StorageContext is empty - call 'poetry run generate' to generate the storage first"
            ),
        )

    sllm = Settings.llm.as_structured_llm(output_cls)

    return index.as_query_engine(
        similarity_top_k=int(top_k),
        llm=sllm,
        response_mode="tree_summarize",
    )
