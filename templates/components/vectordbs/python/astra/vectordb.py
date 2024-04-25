import os
from llama_index.vector_stores.astra_db import AstraDBVectorStore


def get_vector_store():
    store = AstraDBVectorStore(
        token=os.environ["ASTRA_DB_APPLICATION_TOKEN"],
        api_endpoint=os.environ["ASTRA_DB_ENDPOINT"],
        collection_name=os.environ["ASTRA_DB_COLLECTION"],
        embedding_dimension=int(os.environ["EMBEDDING_DIM"]),
    )
    return store
