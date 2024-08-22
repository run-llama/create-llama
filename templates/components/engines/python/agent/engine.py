import os

from app.engine.index import get_index
from app.engine.tools import ToolFactory
from llama_index.core.agent import AgentRunner
from llama_index.core.settings import Settings
from llama_index.core.tools.query_engine import QueryEngineTool


def get_chat_engine(filters=None, params=None):
    system_prompt = os.getenv("SYSTEM_PROMPT")
    top_k = int(os.getenv("TOP_K", 0))
    tools = []

    # Add query tool if index exists
    index = get_index()
    if index is not None:
        query_engine = index.as_query_engine(
            filters=filters, **({"similarity_top_k": top_k} if top_k != 0 else {})
        )
        query_engine_tool = QueryEngineTool.from_defaults(query_engine=query_engine)
        tools.append(query_engine_tool)

    # Add additional tools
    tools += ToolFactory.from_env()

    return AgentRunner.from_llm(
        llm=Settings.llm,
        tools=tools,
        system_prompt=system_prompt,
        verbose=True,
    )
