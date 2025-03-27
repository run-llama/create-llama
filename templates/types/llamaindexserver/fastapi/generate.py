import logging
import os

from dotenv import load_dotenv

from app.settings import init_settings
from llama_index.core.indices import (
    VectorStoreIndex,
)
from llama_index.core.readers import SimpleDirectoryReader

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    load_dotenv()
    init_settings()

    logger.info("Creating new index")
    storage_dir = os.environ.get("STORAGE_DIR", "storage")
    # load the documents and create the index
    reader = SimpleDirectoryReader(
        os.environ.get("DATA_DIR", "data"),
        recursive=True,
    )
    documents = reader.load_data()
    index = VectorStoreIndex.from_documents(
        documents,
        show_progress=True,
    )
    # store it for later
    index.storage_context.persist(storage_dir)
    logger.info(f"Finished creating new index. Stored in {storage_dir}")
