import os

from llama_index.core.vector_stores import SimpleVectorStore
from app.constants import STORAGE_DIR



def get_vector_store():
    if not os.path.exists(STORAGE_DIR):
        vector_store = SimpleVectorStore()
        return vector_store
    else:
        return SimpleVectorStore.from_persist_dir(STORAGE_DIR, namespace="default")

