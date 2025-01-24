import os
from typing import List

from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.tools import BaseTool

from app.engine.index import IndexConfig, get_index
from app.engine.tools import ToolFactory
from app.engine.tools.query_engine import get_query_engine_tool


def get_chat_engine(params=None, **kwargs) -> AgentWorkflow:
    system_prompt = os.getenv("SYSTEM_PROMPT")
    tools: List[BaseTool] = []
    if params is None:
        params = {}

    # Add query tool if index exists
    index_config = IndexConfig(**params)
    index = get_index(index_config)
    if index is not None:
        query_engine_tool = get_query_engine_tool(index, **kwargs)
        tools.append(query_engine_tool)

    # Add additional tools
    configured_tools: List[BaseTool] = ToolFactory.from_env()
    tools.extend(configured_tools)

    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=tools,  # type: ignore
        system_prompt=system_prompt,
    )
