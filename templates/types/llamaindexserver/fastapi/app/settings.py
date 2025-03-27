import os

from llama_index.core import Settings
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI


def init_settings():
    Settings.llm = OpenAI(
        model=os.getenv("MODEL", "gpt-4o-mini"),
        temperature=os.getenv("LLM_TEMPERATURE", 0.5),
        max_tokens=os.getenv("LLM_MAX_TOKENS", 1000),
    )
    Settings.embed_model = OpenAIEmbedding(
        model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
        dimensions=os.getenv("EMBEDDING_DIMENSIONS", 1024),
    )
