import os
from llama_index.vector_stores.pinecone import PineconeVectorStore


def get_vector_store():
    api_key = os.getenv("PINECONE_API_KEY")
    index_name = os.getenv("PINECONE_INDEX_NAME")
    environment = os.getenv("PINECONE_ENVIRONMENT")
    if not api_key or not index_name or not environment:
        raise ValueError(
            "Please set PINECONE_API_KEY, PINECONE_INDEX_NAME, and PINECONE_ENVIRONMENT"
            " to your environment variables or config them in the .env file"
        )
    store = PineconeVectorStore(
        api_key=api_key,
        index_name=index_name,
        environment=environment,
    )
    return store
