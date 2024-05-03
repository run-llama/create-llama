import logging
import os

from llama_index.core.indices import VectorStoreIndex
from llama_index.vector_stores.astra_db import AstraDBVectorStore


logger = logging.getLogger("uvicorn")


def get_index():
    logger.info("Connecting to index from AstraDB...")
    store = AstraDBVectorStore(
        token=os.environ["ASTRA_DB_APPLICATION_TOKEN"],
        api_endpoint=os.environ["ASTRA_DB_ENDPOINT"],
        collection_name=os.environ["ASTRA_DB_COLLECTION"],
        embedding_dimension=int(os.environ["EMBEDDING_DIM"]),
    )
    index = VectorStoreIndex.from_vector_store(store)
    logger.info("Finished connecting to index from AstraDB.")
    return index
