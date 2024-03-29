import os
import logging
from typing import List
from pydantic import BaseModel, validator
from llama_index.core.indices.vector_store import VectorStoreIndex

logger = logging.getLogger(__name__)


class DBLoaderConfig(BaseModel):
    uri: str
    queries: List[str]


def get_db_documents(raw_configs: list[dict]):
    from llama_index.readers.database import DatabaseReader

    # Parse and validate the config
    db_configs = [DBLoaderConfig(**cfg) for cfg in raw_configs]

    docs = []
    for entry in db_configs:
        loader = DatabaseReader(uri=entry.uri)
        for query in entry.queries:
            logger.info(f"Loading data from database with query: {query}")
            documents = loader.load_data(query=query)
            docs.extend(documents)

    return documents
