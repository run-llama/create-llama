import os
from llama_index.vector_stores.astra_db import AstraDBVectorStore


def get_vector_store():
    endpoint = os.getenv("ASTRA_DB_ENDPOINT")
    token = os.getenv("ASTRA_DB_APPLICATION_TOKEN")
    collection = os.getenv("ASTRA_DB_COLLECTION")
    if not endpoint or not token or not collection:
        raise ValueError(
            "Please config ASTRA_DB_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN and ASTRA_DB_COLLECTION"
            " to your environment variables or config them in the .env file"
        )
    store = AstraDBVectorStore(
        token=token,
        api_endpoint=endpoint,
        collection_name=collection,
        embedding_dimension=int(os.getenv("EMBEDDING_DIM")),
    )
    return store
