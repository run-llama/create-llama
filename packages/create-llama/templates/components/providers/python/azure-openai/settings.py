import os

from llama_index.core import Settings
from llama_index.embeddings.azure_openai import AzureOpenAIEmbedding
from llama_index.llms.azure_openai import AzureOpenAI


def init_settings():
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    llm_deployment = os.getenv("AZURE_OPENAI_LLM_DEPLOYMENT")
    embedding_deployment = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION")
    if api_key is None:
        raise RuntimeError("AZURE_OPENAI_API_KEY is missing in environment variables")
    if endpoint is None:
        raise RuntimeError("AZURE_OPENAI_ENDPOINT is missing in environment variables")
    if llm_deployment is None:
        raise RuntimeError(
            "AZURE_OPENAI_LLM_DEPLOYMENT is missing in environment variables"
        )
    if embedding_deployment is None:
        raise RuntimeError(
            "AZURE_OPENAI_EMBEDDING_DEPLOYMENT is missing in environment variables"
        )

    azure_config = {
        "api_key": api_key,
        "azure_endpoint": endpoint,
        "api_version": api_version,
    }

    Settings.llm = AzureOpenAI(
        model="gpt-4.1", deployment_name=llm_deployment, **azure_config
    )
    Settings.embed_model = AzureOpenAIEmbedding(
        model="text-embedding-3-large",
        deployment_name=embedding_deployment,
        **azure_config,
    )
