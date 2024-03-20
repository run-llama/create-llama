from dotenv import load_dotenv

load_dotenv()

import os
import logging
from llama_index.core.indices import VectorStoreIndex
from llama_index.core.storage import StorageContext
from app.engine.constants import STORAGE_DIR
from app.engine.loader import get_documents
from app.settings import init_settings


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    storage_context = StorageContext.from_defaults()

    docs = []

    for doc in get_documents():
        storage_context.docstore.add_documents(doc)
        docs.extend(doc)

    index = VectorStoreIndex.from_documents(docs, storage_context=storage_context)
    index.storage_context.persist(persist_dir=STORAGE_DIR)
    logger.info(f"Generated index at {STORAGE_DIR}")


if __name__ == "__main__":
    init_settings()
    generate_datasource()
