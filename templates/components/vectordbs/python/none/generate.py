from dotenv import load_dotenv

load_dotenv()

import os
import logging
from llama_index.core.settings import Settings
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.indices import (
    VectorStoreIndex,
)
from llama_index.core.vector_stores import SimpleVectorStore
from llama_index.core.vector_stores.types import BasePydanticVectorStore
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.core.storage.storage_context import StorageContext
from app.engine.constants import STORAGE_DIR, TEXT_DOC_STORE_NAME
from app.engine.loaders import get_documents
from app.settings import init_settings


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def get_storage_context():
    docstore = vector_store = None

    if os.path.exists(STORAGE_DIR):
        vector_store = SimpleVectorStore.from_persist_dir(
            persist_dir=STORAGE_DIR, namespace=TEXT_DOC_STORE_NAME
        )
        docstore = SimpleDocumentStore.from_persist_dir(STORAGE_DIR)

    return StorageContext.from_defaults(docstore=docstore, vector_store=vector_store)


def generate_datasource():
    init_settings()
    logger.info("Creating new index")

    # load the documents and create the index
    documents = get_documents()
    storage_context = get_storage_context()

    # Create ingestion pipeline
    ingestion_pipeline = IngestionPipeline(
        transformations=[
            SentenceSplitter(
                chunk_size=Settings.chunk_size,
                chunk_overlap=Settings.chunk_overlap,
            ),
            Settings.embed_model,
        ],
        docstore=storage_context.docstore,
        docstore_strategy="upserts_and_delete",
    )
    ingestion_pipeline.vector_store = storage_context.vector_store

    # Run the ingestion pipeline and store the results
    nodes = ingestion_pipeline.run(show_progress=True, documents=documents)

    # Create the index
    index = VectorStoreIndex(
        nodes=nodes,
        storage_context=storage_context,
    )
    index.storage_context.persist(STORAGE_DIR)

    logger.info(f"Finished creating new index. Stored in {STORAGE_DIR}")


if __name__ == "__main__":
    generate_datasource()
