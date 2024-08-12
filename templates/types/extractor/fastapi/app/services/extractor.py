from typing import Optional

from app.engine import get_query_engine
from app.models.output import Output


class ExtractorService:
    @staticmethod
    def parse_json_schema(json_schema: Optional[str] = None):
        # TODO: Init model from json schema once llama_index supports Pydantic V2
        return Output

    @classmethod
    async def extract(cls, query: str, json_schema: Optional[str] = None) -> str:
        schema_model = cls.parse_json_schema(json_schema)
        # Create a query engine using that returns responses in the format of the schema
        query_engine = get_query_engine(schema_model)
        response = await query_engine.aquery(query)
        output_data = response.response.dict()
        return schema_model(**output_data).json(indent=2)
