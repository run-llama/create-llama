import os
from llama_index.vector_stores.milvus import MilvusVectorStore


def get_vector_store():
    store = MilvusVectorStore(
        uri=os.environ["MILVUS_ADDRESS"],
        user=os.getenv("MILVUS_USERNAME"),
        password=os.getenv("MILVUS_PASSWORD"),
        collection_name=os.getenv("MILVUS_COLLECTION"),
        dim=int(os.getenv("EMBEDDING_DIM")),
    )
    return store
