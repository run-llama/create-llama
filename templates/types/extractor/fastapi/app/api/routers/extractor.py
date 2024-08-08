import logging

from fastapi import APIRouter
from pydantic import BaseModel

from app.engine import get_query_engine
from app.services.schema import SchemaService

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
    # TODO: Add `schema` to the params and initialize the schema model by SchemaService
    # Use default schema model for now
    schema_model = SchemaService().model
    # Create a query engine using that returns responses in the format of the schema
    query_engine = get_query_engine(schema_model)

    response = await query_engine.aquery(data.query)

    output_data = response.response.dict()
    return schema_model(**output_data)
