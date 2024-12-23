import logging

from app.engine import get_query_engine
from app.services.model import IMPORTS

logger = logging.getLogger("uvicorn")


class InvalidModelCode(Exception):
    pass


class ExtractorService:
    @staticmethod
    def _parse_code(model_code: str):
        try:
            python_code = f"{IMPORTS}\n\n{model_code}"
            logger.debug(python_code)
            namespace = {}
            exec(python_code, namespace)
            # using the last object that the user defined in `model_code` as pydantic class
            pydantic_class = namespace[list(namespace.keys())[-1]]
            class_name = pydantic_class.__name__
            logger.info(f"Using Pydantic class {class_name} for extraction")
            return pydantic_class
        except Exception as e:
            logger.error(e)
            raise InvalidModelCode() from e

    @classmethod
    async def extract(cls, query: str, model_code: str) -> str:
        schema_model = cls._parse_code(model_code)
        # Create a query engine using that returns responses in the format of the schema
        query_engine = get_query_engine(schema_model)
        response = await query_engine.aquery(query)
        output_data = response.response.dict()
        return schema_model(**output_data).model_dump_json(indent=2)
