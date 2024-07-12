import os
from app.engine.index import get_index
from fastapi import HTTPException


def get_chat_engine(filters=None):
    system_prompt = os.getenv("SYSTEM_PROMPT")
    top_k = os.getenv("TOP_K", 3)

    index = get_index()
    if index is None:
        raise HTTPException(
            status_code=500,
            detail=str(
                "StorageContext is empty - call 'poetry run generate' to generate the storage first"
            ),
        )

    return index.as_chat_engine(
        similarity_top_k=int(top_k),
        system_prompt=system_prompt,
        chat_mode="condense_plus_context",
        filters=filters,
    )
