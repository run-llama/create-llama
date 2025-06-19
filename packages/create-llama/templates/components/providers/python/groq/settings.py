import os

from llama_index.core import Settings
from llama_index.embeddings.fastembed import FastEmbedEmbedding
from llama_index.llms.groq import Groq

EMBEDDING_MODEL_MAP = {
    "all-MiniLM-L6-v2": "sentence-transformers/all-MiniLM-L6-v2",
    "all-mpnet-base-v2": "sentence-transformers/all-mpnet-base-v2",
}


def init_settings():
    if os.getenv("GROQ_API_KEY") is None:
        raise RuntimeError("GROQ_API_KEY is missing in environment variables")
    Settings.llm = Groq(model=os.getenv("MODEL") or "llama-3.1-8b-instant")
    # This will download the model automatically if it is not already downloaded
    embed_model_name = EMBEDDING_MODEL_MAP[
        os.getenv("EMBEDDING_MODEL") or "all-MiniLM-L6-v2"
    ]
    Settings.embed_model = FastEmbedEmbedding(model_name=embed_model_name)
