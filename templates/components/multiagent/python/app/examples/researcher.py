import os
from textwrap import dedent
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
        return None
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
    tools = []
    query_engine_tool = _create_query_engine_tool()
    if query_engine_tool is not None:
        tools.append(query_engine_tool)
    researcher_tool_names = ["duckduckgo", "wikipedia.WikipediaToolSpec"]
    configured_tools = ToolFactory.from_env(map_result=True)
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
        system_prompt=dedent("""
            You are a researcher agent. You are given a research task.
            If the conversation already includes the information and there is no new request for additional information from the user, you should return the appropriate content to the writer.
            Otherwise, you must use tools to retrieve information needed for the task.
            It's normal for the task to include some ambiguity. You must always think carefully about the context of the user's request to understand what information needs to be retrieved.
            If you use the tools but don't find any related information, please return "I didn't find any new information for {the topic}." Don't try to make up information yourself.
            If the request doesn't need any new information because it was in the conversation history, please return "The task doesn't need any new information. Please reuse the existing content in the conversation history."
            Example:
                Request: "Create a blog post about the history of the internet, write in English and publish in PDF format."
                ->
                Your task: Look for information in English about the history of the Internet.
                This is not your task: Create a blog post or look for how to create a PDF.

                Next request: "Publish the blog post in HTML format."
                ->
                Your task: Return the previous content of the post to the writer. No need to do any research.
                This is not your task: Look for how to create an HTML file.
        """),
        chat_history=chat_history,
    )
