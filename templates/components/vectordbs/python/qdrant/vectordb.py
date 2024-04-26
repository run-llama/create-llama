import os
from llama_index.vector_stores.qdrant import QdrantVectorStore


def get_vector_store():
    store = QdrantVectorStore(
        collection_name=os.getenv("QDRANT_COLLECTION"),
        url=os.getenv("QDRANT_URL"),
        api_key=os.getenv("QDRANT_API_KEY"),
    )
    return store
