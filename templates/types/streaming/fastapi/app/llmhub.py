from llama_index.llms.openai import OpenAI
from llama_index.llms.openai_like import OpenAILike
from llama_index.embeddings.openai import OpenAIEmbedding

class TSIEmbedding(OpenAIEmbedding):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._query_engine = self._text_engine = self.model_name

def llm_config_from_env() -> Dict:
    from llama_index.core.constants import DEFAULT_TEMPERATURE

    model = os.getenv("MODEL")
    temperature = os.getenv("LLM_TEMPERATURE", DEFAULT_TEMPERATURE)
    max_tokens = os.getenv("LLM_MAX_TOKENS")
    api_key = os.getenv("TSI_API_KEY")
    api_base = os.getenv("TSI_API_BASE_URL")

    config = {
        "model": model,
        "api_key": api_key,
        "api_base": api_base,
        "temperature": float(temperature),
        "max_tokens": int(max_tokens) if max_tokens is not None else None,
    }
    return config


def embedding_config_from_env() -> Dict:
    model = os.getenv("EMBEDDING_MODEL")
    dimension = os.getenv("EMBEDDING_DIM")
    api_key = os.getenv("TSI_API_KEY")
    api_base = os.getenv("TSI_EMBED_API_BASE_URL")

    config = {
        "model_name": model,
        "dimension": int(dimension) if dimension is not None else None,
        "api_key": api_key,
        "api_base": api_base,
    }
    return config