import os
from typing import Optional

from fastapi import HTTPException
from llama_index.core.schema import BaseModel
from llama_index.core.settings import Settings

from app.engine.index import get_index


def get_query_engine(output_cls: Optional[type[BaseModel]] = None):
    """
    Get a query engine for the index.
    If output_cls is provided, the query engine will be a structured query engine.
    """
    top_k = int(os.getenv("TOP_K", 10))

    index = get_index()
    if index is None:
        raise HTTPException(
            status_code=500,
            detail=str(
                "StorageContext is empty - call 'poetry run generate' to generate the storage first"
            ),
        )
    if output_cls is not None:
        llm = Settings.llm.as_structured_llm(output_cls)
    else:
        llm = Settings.llm

    return index.as_query_engine(
        llm=llm,
        response_mode="tree_summarize",
        **({"similarity_top_k": top_k} if top_k != 0 else {}),
    )
