import logging
import os
from typing import Dict

from llama_index.core.settings import Settings
from llama_index.embeddings.openai import OpenAIEmbedding

logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-3.5-turbo"
DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large"


class TSIEmbedding(OpenAIEmbedding):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._query_engine = self._text_engine = self.model_name


def llm_config_from_env() -> Dict:
    from llama_index.core.constants import DEFAULT_TEMPERATURE

    model = os.getenv("MODEL", DEFAULT_MODEL)
    temperature = os.getenv("LLM_TEMPERATURE", DEFAULT_TEMPERATURE)
    max_tokens = os.getenv("LLM_MAX_TOKENS")
    api_key = os.getenv("T_SYSTEMS_LLMHUB_API_KEY")
    api_base = os.getenv("T_SYSTEMS_LLMHUB_BASE_URL")

    config = {
        "model": model,
        "api_key": api_key,
        "api_base": api_base,
        "temperature": float(temperature),
        "max_tokens": int(max_tokens) if max_tokens is not None else None,
    }
    return config


def embedding_config_from_env() -> Dict:
    from llama_index.core.constants import DEFAULT_EMBEDDING_DIM

    model = os.getenv("EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
    dimension = os.getenv("EMBEDDING_DIM", DEFAULT_EMBEDDING_DIM)
    api_key = os.getenv("T_SYSTEMS_LLMHUB_API_KEY")
    api_base = os.getenv("T_SYSTEMS_LLMHUB_BASE_URL")

    config = {
        "model_name": model,
        "dimension": int(dimension) if dimension is not None else None,
        "api_key": api_key,
        "api_base": api_base,
    }
    return config


def init_llmhub():
    try:
        from llama_index.llms.openai_like import OpenAILike
    except ImportError:
        logger.error("Failed to import OpenAILike. Make sure llama_index is installed.")
        raise

    llm_configs = llm_config_from_env()
    embedding_configs = embedding_config_from_env()

    Settings.embed_model = TSIEmbedding(**embedding_configs)
    Settings.llm = OpenAILike(
        **llm_configs,
        is_chat_model=True,
        is_function_calling_model=False,
        context_window=4096,
    )
