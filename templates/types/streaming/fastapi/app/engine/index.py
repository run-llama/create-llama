import logging
from llama_index.core.indices.vector_store import VectorStoreIndex
from app.engine.vectordb import get_vector_store

logger = logging.getLogger("uvicorn")


def get_index():
    logger.info("Loading the index...")
    store = get_vector_store()
    index = VectorStoreIndex.from_vector_store(store)
    logger.info("Loaded index successfully.")
    return index
