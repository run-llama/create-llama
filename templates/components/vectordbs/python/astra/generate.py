from dotenv import load_dotenv

load_dotenv()

import os
import logging
from llama_index.core.storage import StorageContext
from llama_index.core.indices import VectorStoreIndex
from llama_index.vector_stores.astra_db import AstraDBVectorStore
from app.settings import init_settings
from app.engine.loaders import get_documents

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    init_settings()
    logger.info("Creating new index")
    documents = get_documents()
    store = AstraDBVectorStore(
        token=os.environ["ASTRA_DB_APPLICATION_TOKEN"],
        api_endpoint=os.environ["ASTRA_DB_ENDPOINT"],
        collection_name=os.environ["ASTRA_DB_COLLECTION"],
        embedding_dimension=int(os.environ["EMBEDDING_DIM"]),
    )
    storage_context = StorageContext.from_defaults(vector_store=store)
    VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True,  # this will show you a progress bar as the embeddings are created
    )
    logger.info(f"Successfully created embeddings in the AstraDB")


if __name__ == "__main__":
    generate_datasource()
