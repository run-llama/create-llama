import os
from typing import Optional

from llama_index.core.tools.query_engine import QueryEngineTool


def create_query_engine(index, **kwargs):
    """
    Create a query engine for the given index.

    Args:
        index: The index to create a query engine for.
        params (optional): Additional parameters for the query engine, e.g: similarity_top_k
    """
    top_k = int(os.getenv("TOP_K", 0))
    if top_k != 0 and kwargs.get("filters") is None:
        kwargs["similarity_top_k"] = top_k
    # If index is index is LlamaCloudIndex
    # use auto_routed mode for better query results
    if (
        index.__class__.__name__ == "LlamaCloudIndex"
        and kwargs.get("auto_routed") is None
    ):
        kwargs["auto_routed"] = True
    return index.as_query_engine(**kwargs)


def get_query_engine_tool(
    index,
    name: Optional[str] = None,
    description: Optional[str] = None,
    **kwargs,
) -> QueryEngineTool:
    """
    Get a query engine tool for the given index.

    Args:
        index: The index to create a query engine for.
        name (optional): The name of the tool.
        description (optional): The description of the tool.
    """
    if name is None:
        name = "query_index"
    if description is None:
        description = (
            "Use this tool to retrieve information about the text corpus from an index."
        )
    query_engine = create_query_engine(index, **kwargs)
    return QueryEngineTool.from_defaults(
        query_engine=query_engine,
        name=name,
        description=description,
    )
