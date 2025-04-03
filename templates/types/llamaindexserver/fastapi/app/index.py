import logging
import os
from typing import Optional

from llama_index.core.indices import load_index_from_storage
from llama_index.server.api.models import ChatRequest
from llama_index.server.tools.index.utils import get_storage_context

logger = logging.getLogger("uvicorn")


def get_index(chat_request: Optional[ChatRequest] = None):
    # check if storage already exists
    storage_dir = os.environ.get("STORAGE_DIR", "storage")
    if not os.path.exists(storage_dir):
        return None
    # load the existing index
    logger.info(f"Loading index from {storage_dir}...")
    storage_context = get_storage_context(storage_dir)
    index = load_index_from_storage(storage_context)
    logger.info(f"Finished loading index from {storage_dir}")
    return index
