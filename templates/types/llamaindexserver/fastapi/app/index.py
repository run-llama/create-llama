import logging
import os

from pydantic import BaseModel

from llama_index.core.indices import load_index_from_storage
from llama_index.server.tools.index.utils import get_storage_context

logger = logging.getLogger("uvicorn")


class IndexConfig(BaseModel):
    storage_dir: str = "storage"


def get_index(config: IndexConfig = None):
    if config is None:
        config = IndexConfig()
    storage_dir = config.storage_dir
    # check if storage already exists
    if not os.path.exists(storage_dir):
        return None
    # load the existing index
    logger.info(f"Loading index from {storage_dir}...")
    storage_context = get_storage_context(storage_dir)
    index = load_index_from_storage(storage_context)
    logger.info(f"Finished loading index from {storage_dir}")
    return index
