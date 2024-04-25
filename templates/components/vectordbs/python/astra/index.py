import logging
import os

from llama_index.core.indices import VectorStoreIndex
from app.engine.vectordb import get_vector_store

logger = logging.getLogger("uvicorn")


def get_index():
    logger.info("Connecting to index from AstraDB...")
    store = get_vector_store()
    index = VectorStoreIndex.from_vector_store(store)
    logger.info("Finished connecting to index from AstraDB.")
    return index
