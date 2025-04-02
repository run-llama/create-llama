import os
from typing import Optional

from app.index import get_index
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.settings import Settings
from llama_index.llms.openai import OpenAI
from llama_index.server.api.models import ChatRequest
from llama_index.server.tools.index import get_query_engine_tool


def create_workflow(chat_request: Optional[ChatRequest] = None) -> AgentWorkflow:
    query_tool = get_query_engine_tool(index=get_index(chat_request=chat_request))
    if query_tool is None:
        raise RuntimeError(
            "Index not found! Please run `poetry run generate` to index the data first."
        )
    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=[query_tool],
        llm=Settings.llm or OpenAI(model="gpt-4o-mini"),
        system_prompt=os.getenv("SYSTEM_PROMPT", "You are a helpful assistant."),
    )
