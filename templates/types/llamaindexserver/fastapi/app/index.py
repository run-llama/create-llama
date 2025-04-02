import logging
import os
from typing import Optional

from llama_index.core.indices import load_index_from_storage
from llama_index.server.api.models import ChatRequest
from llama_index.server.tools.index.utils import get_storage_context
from pydantic import BaseModel

logger = logging.getLogger("uvicorn")


class IndexConfig(BaseModel):
    storage_dir: str = "storage"

    @classmethod
    def from_default(cls, chat_request: Optional[ChatRequest] = None) -> "IndexConfig":
        return cls()


def get_index(chat_request: Optional[ChatRequest] = None):
    config = IndexConfig.from_default(chat_request)
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
