import os

import weaviate
from llama_index.vector_stores.weaviate import WeaviateVectorStore

DEFAULT_INDEX_NAME = "LlamaIndex"


class WeaviateClientSingleton:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(WeaviateClientSingleton, cls).__new__(cls)
            cls._instance.client = cls._create_weaviate_client()
        return cls._instance

    @staticmethod
    def _create_weaviate_client():
        cluster_url = os.getenv("WEAVIATE_CLUSTER_URL")
        api_key = os.getenv("WEAVIATE_API_KEY")
        if not cluster_url or not api_key:
            raise ValueError(
                "Environment variables: WEAVIATE_CLUSTER_URL and WEAVIATE_API_KEY are required."
            )
        auth_credentials = weaviate.auth.AuthApiKey(api_key)
        client = weaviate.connect_to_weaviate_cloud(cluster_url, auth_credentials)
        return client

    def get_client(self):
        return self.client

    def close(self):
        self.client.close()
        WeaviateClientSingleton._instance = None


def get_vector_store():
    index_name = os.getenv("WEAVIATE_INDEX_NAME", DEFAULT_INDEX_NAME)
    client = WeaviateClientSingleton().get_client()
    vector_store = WeaviateVectorStore(
        weaviate_client=client,
        index_name=index_name,
    )
    return vector_store
