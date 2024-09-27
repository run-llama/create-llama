import os
from typing import List

from app.agents.single import FunctionCallingAgent
from app.engine.index import get_index
from app.engine.tools import ToolFactory
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.tools import QueryEngineTool, ToolMetadata


def _create_query_engine_tool() -> QueryEngineTool:
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


def _get_research_tools() -> QueryEngineTool:
    """
    Researcher take responsibility for retrieving information.
    Try init wikipedia or duckduckgo tool if available.
    """
    researcher_tool_names = ["duckduckgo", "wikipedia.WikipediaToolSpec"]
    # Always include the query engine tool
    tools = [_create_query_engine_tool()]
    configured_tools = ToolFactory.from_env(map_result=True)
    print(configured_tools)
    for tool_name, tool in configured_tools.items():
        if tool_name in researcher_tool_names:
            tools.extend(tool)
    return tools


def create_researcher(chat_history: List[ChatMessage]):
    """
    Researcher is an agent that take responsibility for using tools to complete a given task.
    """
    tools = _get_research_tools()
    return FunctionCallingAgent(
        name="researcher",
        tools=tools,
        description="expert in retrieving any unknown content or searching for images from the internet",
        system_prompt="""You are a researcher agent. 
You are given a researching task. You must use tools to retrieve information needed for the task.
It's normal that the task include some ambiguity which you must identify what is the real request that need to retrieve information.
If you don't found any related information, please return "I didn't find any information."
Example:
Task: "Create a blog post about the history of the internet, write in English and publish in PDF format."
->
Your real task: Looking for information in english about the history of the internet
This is not your task: Create blog post, create PDF, write in English
""",
        chat_history=chat_history,
    )
