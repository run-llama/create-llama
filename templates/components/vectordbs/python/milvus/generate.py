from dotenv import load_dotenv

load_dotenv()

import os
import logging
from llama_index.core.storage import StorageContext
from llama_index.core.indices import VectorStoreIndex
from llama_index.vector_stores.milvus import MilvusVectorStore
from app.settings import init_settings
from app.engine.loaders import get_documents

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    init_settings()
    logger.info("Creating new index")
    # load the documents and create the index
    documents = get_documents()
    store = MilvusVectorStore(
        uri=os.environ["MILVUS_ADDRESS"],
        user=os.getenv("MILVUS_USERNAME"),
        password=os.getenv("MILVUS_PASSWORD"),
        collection_name=os.getenv("MILVUS_COLLECTION"),
        dim=int(os.getenv("EMBEDDING_DIM")),
    )
    storage_context = StorageContext.from_defaults(vector_store=store)
    VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True,  # this will show you a progress bar as the embeddings are created
    )
    logger.info(f"Successfully created embeddings in the Milvus")


if __name__ == "__main__":
    generate_datasource()
