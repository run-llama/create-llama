import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.models.output import Output
from app.engine import get_query_engine

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
