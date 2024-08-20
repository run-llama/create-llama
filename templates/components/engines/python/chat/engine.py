import os

from app.engine.index import get_index
from app.engine.node_postprocessors import NodeCitationProcessor
from fastapi import HTTPException
from llama_index.core.chat_engine import CondensePlusContextChatEngine


def get_chat_engine(filters=None, params=None):
    system_prompt = os.getenv("SYSTEM_PROMPT")
    citation_prompt = os.getenv("SYSTEM_CITATION_PROMPT", None)
    top_k = int(os.getenv("TOP_K", 3))

    node_postprocessors = []
    if citation_prompt:
        node_postprocessors = [NodeCitationProcessor()]
        system_prompt = f"{system_prompt}\n{citation_prompt}"

    index = get_index(params)
    if index is None:
        raise HTTPException(
            status_code=500,
            detail=str(
                "StorageContext is empty - call 'poetry run generate' to generate the storage first"
            ),
        )

    retriever = index.as_retriever(
        similarity_top_k=top_k,
        filters=filters,
    )

    return CondensePlusContextChatEngine.from_defaults(
        system_prompt=system_prompt,
        retriever=retriever,
        node_postprocessors=node_postprocessors,
    )
