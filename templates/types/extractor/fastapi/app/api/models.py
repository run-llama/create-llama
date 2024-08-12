
from pydantic import BaseModel


class RequestData(BaseModel):
    query: str

    class Config:
        json_schema_extra = {
            "examples": [
                {"query": "What's the maximum weight for a parcel?"},
            ],
        }

