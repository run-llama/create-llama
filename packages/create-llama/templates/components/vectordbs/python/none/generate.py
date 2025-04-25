# flake8: noqa: E402
from dotenv import load_dotenv

load_dotenv()

import logging
import os

from app.engine.loaders import get_documents
from app.settings import init_settings
from llama_index.core.indices import (
    VectorStoreIndex,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    init_settings()
    logger.info("Creating new index")
    storage_dir = os.environ.get("STORAGE_DIR", "storage")
    # load the documents and create the index
    documents = get_documents()
    # Set private=false to mark the document as public (required for filtering)
    for doc in documents:
        doc.metadata["private"] = "false"
    index = VectorStoreIndex.from_documents(
        documents,
        show_progress=True,
    )
    # store it for later
    index.storage_context.persist(storage_dir)
    logger.info(f"Finished creating new index. Stored in {storage_dir}")


if __name__ == "__main__":
    generate_datasource()
