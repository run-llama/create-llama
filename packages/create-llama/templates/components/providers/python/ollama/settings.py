import os

from llama_index.core import Settings
from llama_index.embeddings.ollama import OllamaEmbedding
from llama_index.llms.ollama import Ollama


def init_settings():
    if os.getenv("OLLAMA_BASE_URL") is None:
        raise RuntimeError("OLLAMA_BASE_URL is missing in environment variables")
    base_url = os.getenv("OLLAMA_BASE_URL") or "http://127.0.0.1:11434"
    llm_model = os.getenv("MODEL") or "llama3.1"
    embed_model = os.getenv("EMBEDDING_MODEL") or "nomic-embed-text"

    Settings.llm = Ollama(model=llm_model, base_url=base_url)
    Settings.embed_model = OllamaEmbedding(model=embed_model, base_url=base_url)
