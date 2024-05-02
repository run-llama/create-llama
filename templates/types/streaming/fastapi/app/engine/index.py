import logging
from llama_index.core import load_index_from_storage
from llama_index.core.storage import StorageContext
from llama_index.core.indices.vector_store import VectorStoreIndex
from llama_index.core.vector_stores.simple import SimpleVectorStore
from app.constants import STORAGE_DIR
from app.engine.vectordb import get_vector_store

logger = logging.getLogger("uvicorn")


def get_index():
    logger.info("Loading the index...")
    store = get_vector_store()
    # If the store is a SimpleVectorStore, we need to load the index from the storage
    if isinstance(store, SimpleVectorStore):
        index = load_index_from_storage(
            StorageContext.from_defaults(
                vector_store=store,
                persist_dir=STORAGE_DIR,
            )
        )
    else:
        index = VectorStoreIndex.from_vector_store(store)

    logger.info("Loaded index successfully.")
    return index
