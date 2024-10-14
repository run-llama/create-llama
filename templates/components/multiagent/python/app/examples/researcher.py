import os
from textwrap import dedent
from typing import List

from app.agents.single import FunctionCallingAgent
from app.engine.index import IndexConfig, get_index
from app.engine.tools import ToolFactory
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.tools import QueryEngineTool, ToolMetadata


def _create_query_engine_tool(params=None) -> QueryEngineTool:
    """
    Provide an agent worker that can be used to query the index.
    """
    # Add query tool if index exists
    index_config = IndexConfig(**(params or {}))
    index = get_index(index_config)
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


def _get_research_tools(**kwargs) -> QueryEngineTool:
    """
    Researcher take responsibility for retrieving information.
    Try init wikipedia or duckduckgo tool if available.
    """
    tools = []
    query_engine_tool = _create_query_engine_tool(**kwargs)
    if query_engine_tool is not None:
        tools.append(query_engine_tool)
    researcher_tool_names = ["duckduckgo", "wikipedia.WikipediaToolSpec"]
    configured_tools = ToolFactory.from_env(map_result=True)
    for tool_name, tool in configured_tools.items():
        if tool_name in researcher_tool_names:
            tools.extend(tool)
    return tools


def create_researcher(chat_history: List[ChatMessage], **kwargs):
    """
    Researcher is an agent that take responsibility for using tools to complete a given task.
    """
    tools = _get_research_tools(**kwargs)
    return FunctionCallingAgent(
        name="researcher",
        tools=tools,
        description="expert in retrieving any unknown content or searching for images from the internet",
        system_prompt=dedent(
            """
            You are a researcher agent. You are given a research task.
            
            If the conversation already includes the information and there is no new request for additional information from the user, you should return the appropriate content to the writer.
            Otherwise, you must use tools to retrieve information or images needed for the task.

            It's normal for the task to include some ambiguity. You must always think carefully about the context of the user's request to understand what are the main content needs to be retrieved.
            Example:
                Request: "Create a blog post about the history of the internet, write in English and publish in PDF format."
                ->Though: The main content is "history of the internet", while "write in English and publish in PDF format" is a requirement for other agents.
                Your task: Look for information in English about the history of the Internet.
                This is not your task: Create a blog post or look for how to create a PDF.

                Next request: "Publish the blog post in HTML format."
                ->Though: User just asking for a format change, the previous content is still valid.
                Your task: Return the previous content of the post to the writer. No need to do any research.
                This is not your task: Look for how to create an HTML file.

            If you use the tools but don't find any related information, please return "I didn't find any new information for {the topic}." along with the content you found. Don't try to make up information yourself.
            If the request doesn't need any new information because it was in the conversation history, please return "The task doesn't need any new information. Please reuse the existing content in the conversation history."
        """
        ),
        chat_history=chat_history,
    )
