import os
import logging
from datetime import timedelta

from cachetools import cached, TTLCache
from llama_index.core.storage import StorageContext
from llama_index.core.indices import load_index_from_storage

logger = logging.getLogger("uvicorn")


@cached(
    TTLCache(maxsize=10, ttl=timedelta(minutes=5).total_seconds()),
    key=lambda *args, **kwargs: "global_storage_context",
)
def get_storage_context(persist_dir: str) -> StorageContext:
    return StorageContext.from_defaults(persist_dir=persist_dir)


def get_index():
    storage_dir = os.getenv("STORAGE_DIR", "storage")
    # check if storage already exists
    if not os.path.exists(storage_dir):
        return None
    # load the existing index
    logger.info(f"Loading index from {storage_dir}...")
    storage_context = get_storage_context(storage_dir)
    index = load_index_from_storage(storage_context)
    logger.info(f"Finished loading index from {storage_dir}")
    return index
