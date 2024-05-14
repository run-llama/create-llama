import logging

from llama_index.core.indices import VectorStoreIndex
from app.engine.vectordb import get_vector_store

logger = logging.getLogger("uvicorn")


def get_index():
    logger.info("Connecting to ChromaDB..")
    store = get_vector_store()
    index = VectorStoreIndex.from_vector_store(store, use_async=False)
    logger.info("Finished connecting to ChromaDB.")
    return index
