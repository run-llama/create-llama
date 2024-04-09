import logging
import os
from app.engine.loaders import get_documents
from app.settings import init_settings
from dotenv import load_dotenv
from llama_index.core.indices import VectorStoreIndex
from llama_index.core.storage import StorageContext
from llama_index.vector_stores.qdrant import QdrantVectorStore
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    init_settings()
    logger.info("Creating new index with Qdrant")
    # load the documents and create the index
    documents = get_documents()
    store = QdrantVectorStore(
        collection_name=os.getenv("QDRANT_COLLECTION"),
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
    )
    storage_context = StorageContext.from_defaults(vector_store=store)
    VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True,  # this will show you a progress bar as the embeddings are created
    )
    logger.info(
        f"Successfully uploaded documents to the {os.getenv('QDRANT_COLLECTION')} collection."
    )


if __name__ == "__main__":
    generate_datasource()
