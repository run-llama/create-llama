import os
from typing import List

from app.agents.single import FunctionCallingAgent
from app.engine.index import get_index
from app.tools.duckduckgo import get_tools as get_duckduckgo_tools
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.tools import QueryEngineTool, ToolMetadata


def get_query_engine_tool() -> QueryEngineTool:
    """
    Provide an agent worker that can be used to query the index.
    """
    index = get_index()
    if index is None:
        raise ValueError("Index not found. Please create an index first.")
    top_k = int(os.getenv("TOP_K", 0))
    query_engine = index.as_query_engine(
        **({"similarity_top_k": top_k} if top_k != 0 else {})
    )
    return QueryEngineTool(
        query_engine=query_engine,
        metadata=ToolMetadata(
            name="query_index",
            description="""
                Use this tool to retrieve information about the text corpus from the index.
            """,
        ),
    )


def create_researcher(chat_history: List[ChatMessage]):
    duckduckgo_search_tools = get_duckduckgo_tools()
    return FunctionCallingAgent(
        name="researcher",
        tools=[get_query_engine_tool(), *duckduckgo_search_tools],
        description="expert in retrieving any unknown content or searching for images from the internet",
        system_prompt="You are a researcher agent. You are given a researching task. You must use tools to retrieve information from the knowledge base and search for needed images from the internet for the post.",
        chat_history=chat_history,
    )
