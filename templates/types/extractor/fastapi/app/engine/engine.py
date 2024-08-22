import os

from fastapi import HTTPException
from llama_index.core.settings import Settings

from app.engine.index import get_index


def get_query_engine(output_cls):
    top_k = int(os.getenv("TOP_K", 0))

    index = get_index()
    if index is None:
        raise HTTPException(
            status_code=500,
            detail=str(
                "StorageContext is empty - call 'poetry run generate' to generate the storage first"
            ),
        )

    sllm = Settings.llm.as_structured_llm(output_cls)

    return index.as_query_engine(
        llm=sllm,
        response_mode="tree_summarize",
        **({"similarity_top_k": top_k} if top_k != 0 else {}),
    )
