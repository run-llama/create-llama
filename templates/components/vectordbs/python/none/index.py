import logging
import os

from llama_index.core.storage import StorageContext
from llama_index.core.indices import load_index_from_storage

logger = logging.getLogger("uvicorn")


def get_index():
    storage_dir = os.getenv("STORAGE_DIR", "storage")
    # check if storage already exists
    if not os.path.exists(storage_dir):
        return None
    # load the existing index
    logger.info(f"Loading index from {storage_dir}...")
    storage_context = StorageContext.from_defaults(persist_dir=storage_dir)
    index = load_index_from_storage(storage_context)
    logger.info(f"Finished loading index from {storage_dir}")
    return index
