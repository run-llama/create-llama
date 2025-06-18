import os

from llama_index.core import Settings
from llama_index.embeddings.google_genai import GoogleGenAIEmbedding
from llama_index.llms.google_genai import GoogleGenAI


def init_settings():
    if os.getenv("GOOGLE_API_KEY") is None:
        raise RuntimeError("GOOGLE_API_KEY is missing in environment variables")
    Settings.llm = GoogleGenAI(model=os.getenv("MODEL") or "gemini-2.0-flash")
    Settings.embed_model = GoogleGenAIEmbedding(
        model=os.getenv("EMBEDDING_MODEL") or "text-embedding-004"
    )
