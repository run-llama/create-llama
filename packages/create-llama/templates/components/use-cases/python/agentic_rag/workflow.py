from typing import Optional

from app.index import get_index
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.settings import Settings
from llama_index.server.api.models import ChatRequest
from llama_index.server.tools.index import get_query_engine_tool
from llama_index.server.tools.index.citation import (
    CITATION_SYSTEM_PROMPT,
    enable_citation,
)


def create_workflow(chat_request: Optional[ChatRequest] = None) -> AgentWorkflow:
    index = get_index(chat_request=chat_request)
    if index is None:
        raise RuntimeError(
            "Index not found! Please run `uv run generate` to index the data first."
        )
    # Create a query tool with citations enabled
    query_tool = enable_citation(get_query_engine_tool(index=index))

    # Define the system prompt for the agent
    # Append the citation system prompt to the system prompt
    system_prompt = """You are a helpful assistant"""
    system_prompt += CITATION_SYSTEM_PROMPT

    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=[query_tool],
        llm=Settings.llm,
        system_prompt=system_prompt,
    )
