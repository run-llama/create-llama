import os
from llama_index.vector_stores.pinecone import PineconeVectorStore


def get_vector_store():
    store = PineconeVectorStore(
        api_key=os.environ["PINECONE_API_KEY"],
        index_name=os.environ["PINECONE_INDEX_NAME"],
        environment=os.environ["PINECONE_ENVIRONMENT"],
    )
    return store
