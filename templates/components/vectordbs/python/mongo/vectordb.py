import os
from llama_index.vector_stores.mongodb import MongoDBAtlasVectorSearch


def get_vector_store():
    db_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DATABASE")
    collection_name = os.getenv("MONGODB_VECTORS")
    index_name = os.getenv("MONGODB_VECTOR_INDEX")
    if not db_uri or not db_name or not collection_name or not index_name:
        raise ValueError(
            "Please set MONGODB_URI, MONGODB_DATABASE, MONGODB_VECTORS, and MONGODB_VECTOR_INDEX"
            " to your environment variables or config them in .env file"
        )
    store = MongoDBAtlasVectorSearch(
        db_name=db_name,
        collection_name=collection_name,
        index_name=index_name,
    )
    return store
