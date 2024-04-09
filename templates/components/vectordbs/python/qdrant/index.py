import logging
import os

from llama_index.core.indices import VectorStoreIndex
from llama_index.vector_stores.qdrant import QdrantVectorStore


logger = logging.getLogger("uvicorn")


def get_index():
    logger.info("Connecting to Qdrant collection..")
    store = QdrantVectorStore(
        collection_name=os.getenv("QDRANT_COLLECTION"),
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
    )
    index = VectorStoreIndex.from_vector_store(store)
    logger.info("Finished connecting to Qdrant collection.")
    return index
