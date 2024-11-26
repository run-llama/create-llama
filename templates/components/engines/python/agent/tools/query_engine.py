import os
from typing import Any, Dict, Optional

from llama_index.core.tools.query_engine import QueryEngineTool


def create_query_engine(index, params: Optional[Dict[str, Any]] = None):
    params = params or {}
    top_k = int(os.getenv("TOP_K", 0))
    if top_k != 0:
        params["similarity_top_k"] = top_k
    # If index is index is LlamaCloudIndex
    # use auto_routed mode for better query results
    if index.__class__.__name__ == "LlamaCloudIndex":
        params["auto_routed"] = True
    return index.as_query_engine(**params)


def get_query_engine_tool(
    index,
    engine_params: Optional[Dict[str, Any]] = None,
    tool_name: Optional[str] = None,
    tool_description: Optional[str] = None,
) -> QueryEngineTool:
    """
    Get a query engine tool for the given index.

    Args:
        index: The index to create a query engine for.
        engine_params (optional): Additional parameters for the query engine, e.g: similarity_top_k
        tool_name (optional): The name of the tool.
        tool_description (optional): The description of the tool.
    """
    query_engine = create_query_engine(index, engine_params)
    return QueryEngineTool.from_defaults(
        query_engine=query_engine,
        name=tool_name,
        description=tool_description,
    )


def get_tools(**kwargs):
    raise ValueError(
        "Query engine tool cannot be created from ToolFactory. Call get_query_engine_tool instead."
    )
