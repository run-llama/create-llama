from pydantic import BaseModel

from app.services.model import DEFAULT_MODEL


class RequestData(BaseModel):
    query: str
    code: str = DEFAULT_MODEL

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "query": "What's the maximum weight for a parcel?",
                    "code": DEFAULT_MODEL,
                },
            ],
        }
