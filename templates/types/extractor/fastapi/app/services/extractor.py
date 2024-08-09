from app.engine import get_query_engine
from app.models.request import RequestData
from app.services.schema import SchemaService


class ExtractorService:

    @classmethod
    async def extract(cls, data: RequestData):
        # TODO: Add `schema` to the params and initialize the schema model by SchemaService
        # Use default schema model for now
        schema_model = SchemaService().model
        # Create a query engine using that returns responses in the format of the schema
        query_engine = get_query_engine(schema_model)
        response = await query_engine.aquery(data.query)
        output_data = response.response.dict()
        return schema_model(**output_data).json(indent=2)