import logging
from typing import Any

from app.engine.engine import get_query_engine
from app.services.model import IMPORTS
from llama_index.core.prompts import PromptTemplate
from llama_index.core.settings import Settings
from pydantic import BaseModel, Field

logger = logging.getLogger("uvicorn")


class InvalidModelCode(Exception):
    pass


class SubQueries(BaseModel):
    queries: list[str] = Field(
        default_factory=list,
        description="List of queries to retrieve data from the knowledge base.",
    )


class ExtractorService:
    @staticmethod
    def _parse_code(model_code: str) -> type[BaseModel]:
        try:
            python_code = f"{IMPORTS}\n\n{model_code}"
            logger.debug(python_code)
            namespace: dict[str, Any] = {}
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
    def _queries_generation(
        cls, user_request: str, output_model: type[BaseModel]
    ) -> list[str]:
        """
        Generate a list of queries to retrieve the needed information from a knowledge base to complete the output model.
        """

        prompt = PromptTemplate(
            """
            Given an expected output model and a user request, produce a list of queries to efficiently retrieve the data from a knowledge base to complete the output model.

            # Guidelines:
                - Understand the objects in the user request and their relationships with the output model.
                - Grasp the output fields and their relationships.
                - Produce queries that retrieve all the necessary information to fill out the output model.
                - Ensure that all output fields are covered by the queries.

            # Example:
                User request: What are the most common religions in Southeast Asia?
                Output model: ```
                {'properties': {'country': {'title': 'Country', 'type': 'string'}, 'religions': {'items': {'type': 'string'}, 'title': 'Religions', 'type': 'array'}}, 'required': ['country', 'religions'], 'title': 'SoutheastAsiaReligions', 'type': 'object'}
                ```
                Sub queries: [
                    "What are the religions in Indonesia, Malaysia, Brunei, Timor-Leste, and Singapore?",
                    "What are the religions in Thailand and Myanmar?",
                    "What are the religions in Cambodia, Vietnam, and Laos?",
                    "What are the religions in the Philippines?",
                ]

            # Task:
            Here is your task:
            User request: {user_request}
            Output model: {output_model}
            """
        )
        output = Settings.llm.structured_predict(
            output_cls=SubQueries,
            prompt=prompt,
            user_request=user_request,
            output_model=output_model.model_json_schema(),
        )
        return output.queries

    @classmethod
    async def extract(cls, query: str, model_code: str) -> dict[str, Any]:
        # Parse the user-defined Pydantic class
        schema_model = cls._parse_code(model_code)

        # Get list of sub queries to retrieve the needed information from a knowledge base
        queries = cls._queries_generation(query, schema_model)
        logger.debug(f"Sub queries: {queries}")

        # Retrieve the needed information from a knowledge base
        query_results: list[str] = []
        query_engine = get_query_engine()
        for sub_query in queries:
            res = query_engine.query(sub_query)
            query_results.append(res.response)
        logger.debug(f"Query results: {query_results}")

        # Fill-up the answer with the retrieved information
        result = Settings.llm.structured_predict(
            output_cls=schema_model,
            prompt=PromptTemplate(
                """
                Fill-up the answer with the following information:
                {query_results}
                """
            ),
            query_results=query_results,
            query=query,
        )
        return result.model_dump_json(indent=2)
