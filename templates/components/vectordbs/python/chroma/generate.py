from dotenv import load_dotenv

load_dotenv()

import os
import logging
from llama_index.core.storage import StorageContext
from llama_index.core.indices import VectorStoreIndex
from app.settings import init_settings
from app.engine.loaders import get_documents
from app.engine.vectordb import get_vector_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    init_settings()
    logger.info("Creating new index")
    # load the documents and create the index
    documents = get_documents()
    store = get_vector_store()
    storage_context = StorageContext.from_defaults(vector_store=store)
    VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True,  # this will show you a progress bar as the embeddings are created
    )
    logger.info("Successfully created embeddings in the ChromaDB")


if __name__ == "__main__":
    generate_datasource()
