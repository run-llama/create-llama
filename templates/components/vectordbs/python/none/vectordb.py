import os

from llama_index.core.vector_stores import SimpleVectorStore
from app.constants import STORAGE_DIR


def get_vector_store():
    if not os.path.exists(STORAGE_DIR):
        # Vector store hasn't been persisted before, create a new one
        vector_store = SimpleVectorStore()
    else:
        # Vector store has already been persisted before at STORAGE_DIR - load it
        vector_store = SimpleVectorStore.from_persist_dir(
            STORAGE_DIR, namespace="default"
        )
    return vector_store
