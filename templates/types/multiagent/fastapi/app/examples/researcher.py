import os
from typing import List
from llama_index.core.tools import QueryEngineTool, ToolMetadata
from app.agents.single import FunctionCallingAgent
from app.engine.index import get_index

from llama_index.core.chat_engine.types import ChatMessage


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
    return FunctionCallingAgent(
        name="researcher",
        tools=[get_query_engine_tool()],
        role="expert in retrieving any unknown content",
        system_prompt="You are a researcher agent. You are given a researching task. You must use your tools to complete the research.",
        chat_history=chat_history,
    )
