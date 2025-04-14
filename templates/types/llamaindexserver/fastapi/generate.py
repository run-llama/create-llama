import logging
import os

from app.index import STORAGE_DIR
from app.settings import init_settings
from dotenv import load_dotenv
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
    index.storage_context.persist(STORAGE_DIR)
    logger.info(f"Finished creating new index. Stored in {STORAGE_DIR}")
