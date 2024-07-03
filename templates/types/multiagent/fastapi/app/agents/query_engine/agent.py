import os
from llama_agents import AgentService, SimpleMessageQueue
from llama_index.core.agent import FunctionCallingAgentWorker
from llama_index.core.tools import QueryEngineTool, ToolMetadata
from llama_index.core.settings import Settings
from app.engine.index import get_index
from app.utils import load_from_env


DEFAULT_QUERY_ENGINE_AGENT_DESCRIPTION = (
    "Used to answer the questions using the provided context data."
)


def get_query_engine_tool() -> QueryEngineTool:
    """
    Provide an agent worker that can be used to query the index.
    """
    index = get_index()
    if index is None:
        raise ValueError("Index not found. Please create an index first.")
    query_engine = index.as_query_engine(similarity_top_k=int(os.getenv("TOP_K", 3)))
    return QueryEngineTool(
        query_engine=query_engine,
        metadata=ToolMetadata(
            name="context_data",
            description="""
                Provide the provided context information. 
                Use a detailed plain text question as input to the tool.
            """,
        ),
    )


def init_query_engine_agent(
    message_queue: SimpleMessageQueue,
) -> AgentService:
    """
    Initialize the agent service.
    """
    agent = FunctionCallingAgentWorker(
        tools=[get_query_engine_tool()], llm=Settings.llm, prefix_messages=[]
    ).as_agent()
    return AgentService(
        service_name="context_query_agent",
        agent=agent,
        message_queue=message_queue.client,
        description=load_from_env("AGENT_QUERY_ENGINE_DESCRIPTION", throw_error=False)
        or DEFAULT_QUERY_ENGINE_AGENT_DESCRIPTION,
        host=load_from_env("AGENT_QUERY_ENGINE_HOST", throw_error=False) or "127.0.0.1",
        port=int(load_from_env("AGENT_QUERY_ENGINE_PORT")),
    )
