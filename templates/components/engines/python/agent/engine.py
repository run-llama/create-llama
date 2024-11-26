import os
from typing import List

from llama_index.core.agent import AgentRunner
from llama_index.core.callbacks import CallbackManager
from llama_index.core.settings import Settings
from llama_index.core.tools import BaseTool
from llama_index.core.tools.query_engine import QueryEngineTool

from app.engine.index import IndexConfig, get_index
from app.engine.tools import ToolFactory
from app.engine.tools.query_engine import create_query_engine


def get_chat_engine(filters=None, params=None, event_handlers=None, **kwargs):
    system_prompt = os.getenv("SYSTEM_PROMPT")
    tools: List[BaseTool] = []
    callback_manager = CallbackManager(handlers=event_handlers or [])

    # Add query tool if index exists
    index_config = IndexConfig(callback_manager=callback_manager, **(params or {}))
    index = get_index(index_config)
    if index is not None:
        query_engine = create_query_engine(index, params)
        query_engine_tool = QueryEngineTool.from_defaults(query_engine=query_engine)
        tools.append(query_engine_tool)

    # Add additional tools
    configured_tools: List[BaseTool] = ToolFactory.from_env()
    tools.extend(configured_tools)

    return AgentRunner.from_llm(
        llm=Settings.llm,
        tools=tools,
        system_prompt=system_prompt,
        callback_manager=callback_manager,
        verbose=True,
    )
