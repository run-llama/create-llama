import os
from llama_index.vector_stores.milvus import MilvusVectorStore


def get_vector_store():
    address = os.getenv("MILVUS_ADDRESS")
    collection = os.getenv("MILVUS_COLLECTION")
    if not address or not collection:
        raise ValueError(
            "Please set MILVUS_ADDRESS and MILVUS_COLLECTION to your environment variables"
            " or config them in the .env file"
        )
    store = MilvusVectorStore(
        uri=address,
        user=os.getenv("MILVUS_USERNAME"),
        password=os.getenv("MILVUS_PASSWORD"),
        collection_name=collection,
        dim=int(os.getenv("EMBEDDING_DIM")),
    )
    return store
