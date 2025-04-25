import logging
import os
from typing import Optional

from llama_index.core.indices import load_index_from_storage
from llama_index.server.api.models import ChatRequest
from llama_index.server.tools.index.utils import get_storage_context

logger = logging.getLogger("uvicorn")

STORAGE_DIR = "storage"


def get_index(chat_request: Optional[ChatRequest] = None):
    # check if storage already exists
    if not os.path.exists(STORAGE_DIR):
        return None
    # load the existing index
    logger.info(f"Loading index from {STORAGE_DIR}...")
    storage_context = get_storage_context(STORAGE_DIR)
    index = load_index_from_storage(storage_context)
    logger.info(f"Finished loading index from {STORAGE_DIR}")
    return index
