import os
import logging
from llama_index.core.storage import StorageContext
from llama_index.core.indices import load_index_from_storage
from app.constants import STORAGE_DIR


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def get_index():
    # check if storage already exists
    if not os.path.exists(STORAGE_DIR):
        raise Exception(f"Storage directory {STORAGE_DIR} does not exist.")
    # load the existing index
    logger.info(f"Loading index from {STORAGE_DIR}...")
    storage_context = StorageContext.from_defaults(persist_dir=STORAGE_DIR)
    index = load_index_from_storage(storage_context)
    logger.info(f"Finished loading index from {STORAGE_DIR}")
    return index
