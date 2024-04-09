import logging
import os

from llama_index.core.indices import VectorStoreIndex
from llama_index.vector_stores.milvus import MilvusVectorStore


logger = logging.getLogger("uvicorn")


def get_index():
    logger.info("Connecting to index from Milvus...")
    store = MilvusVectorStore(
        uri=os.getenv("MILVUS_ADDRESS"),
        user=os.getenv("MILVUS_USERNAME"),
        password=os.getenv("MILVUS_PASSWORD"),
        collection_name=os.getenv("MILVUS_COLLECTION"),
        dim=int(os.getenv("EMBEDDING_DIM")),
    )
    index = VectorStoreIndex.from_vector_store(store)
    logger.info("Finished connecting to index from Milvus.")
    return index
