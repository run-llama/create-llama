from dotenv import load_dotenv

load_dotenv()

import os
import logging
from llama_index.core.settings import Settings
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.node_parser import SentenceSplitter
from llama_index.core.vector_stores import SimpleVectorStore
from llama_index.core.storage.docstore import SimpleDocumentStore
from llama_index.core.storage import StorageContext
from llama_index.core import VectorStoreIndex
from app.constants import STORAGE_DIR
from app.settings import init_settings
from app.engine.loaders import get_documents
from app.engine.vectordb import get_vector_store


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def get_doc_store():
    if not os.path.exists(STORAGE_DIR):
        docstore = SimpleDocumentStore()
        return docstore
    else:
        return SimpleDocumentStore.from_persist_dir(STORAGE_DIR)


def run_ingestion_pipeline(docstore, vector_store, documents):
    # Create ingestion pipeline
    ingestion_pipeline = IngestionPipeline(
        transformations=[
            SentenceSplitter(
                chunk_size=Settings.chunk_size,
                chunk_overlap=Settings.chunk_overlap,
            ),
            Settings.embed_model,
        ],
        docstore=docstore,
        docstore_strategy="upserts_and_delete",
    )

    # llama_index having an typing issue when passing vector_store to IngestionPipeline
    # so we need to set it manually after initialization
    ingestion_pipeline.vector_store = vector_store

    # Run the ingestion pipeline and store the results
    nodes = ingestion_pipeline.run(show_progress=True, documents=documents)

    return nodes


def persist_storage(docstore, vector_store, nodes):
    storage_context = StorageContext.from_defaults(
        docstore=docstore,
        vector_store=vector_store,
    )
    # SimpleVectorStore does not include index by default
    # so we need to create the index manually
    # can be removed if using other vector store
    if isinstance(vector_store, SimpleVectorStore):
        VectorStoreIndex(
            nodes=nodes,
            storage_context=storage_context,
            store_nodes_override=True,  # Need enable this to store the nodes and index's id
        )
    storage_context.persist(STORAGE_DIR)


def generate_datasource():
    init_settings()
    logger.info("Indexing the data")

    # Get the stores and documents or create new ones
    documents = get_documents()
    docstore = get_doc_store()
    vector_store = get_vector_store()

    # Run the ingestion pipeline
    nodes = run_ingestion_pipeline(
        docstore=docstore,
        vector_store=vector_store,
        documents=documents,
    )

    # Build the index and persist storage
    persist_storage(docstore, vector_store, nodes)

    logger.info("Finished the indexing")


if __name__ == "__main__":
    generate_datasource()
