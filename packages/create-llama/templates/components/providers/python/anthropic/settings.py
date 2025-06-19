import os

from llama_index.core import Settings
from llama_index.embeddings.fastembed import FastEmbedEmbedding
from llama_index.llms.anthropic import Anthropic

EMBEDDING_MODEL_MAP = {
    "all-MiniLM-L6-v2": "sentence-transformers/all-MiniLM-L6-v2",
    "all-mpnet-base-v2": "sentence-transformers/all-mpnet-base-v2",
}


def init_settings():
    if os.getenv("ANTHROPIC_API_KEY") is None:
        raise RuntimeError("ANTHROPIC_API_KEY is missing in environment variables")
    Settings.llm = Anthropic(model=os.getenv("MODEL") or "claude-3-sonnet")
    # This will download the model automatically if it is not already downloaded
    embed_model_name = EMBEDDING_MODEL_MAP[
        os.getenv("EMBEDDING_MODEL") or "all-MiniLM-L6-v2"
    ]
    Settings.embed_model = FastEmbedEmbedding(model_name=embed_model_name)
