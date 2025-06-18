import os

from llama_index.core import Settings
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI


def init_settings():
    if os.getenv("OPENAI_API_KEY") is None:
        raise RuntimeError("OPENAI_API_KEY is missing in environment variables")
    Settings.llm = OpenAI(model=os.getenv("MODEL") or "gpt-4.1")
    Settings.embed_model = OpenAIEmbedding(
        model=os.getenv("EMBEDDING_MODEL") or "text-embedding-3-large"
    )
