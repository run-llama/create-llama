import os
from llama_agents import (
    AgentService,
    LocalLauncher,
    SimpleMessageQueue,
    ControlPlaneServer,
    AgentOrchestrator,
)
from llama_index.core.settings import Settings
from llama_index.core.agent import FunctionCallingAgentWorker
from llama_index.core.tools import QueryEngineTool, ToolMetadata
from app.engine.index import get_index


def init_message_queue():
    return SimpleMessageQueue()


def init_agent(message_queue: SimpleMessageQueue) -> AgentService:
    """
    Initialize the agent service.
    """
    index = get_index()
    if index is None:
        raise ValueError("Index not found. Please create an index first.")
    query_engine_tool = QueryEngineTool(
        query_engine=index.as_query_engine(similarity_top_k=int(os.getenv("TOP_K", 3))),
        metadata=ToolMetadata(
            name="context_data",
            description="""
                Provide the provided context information. 
                Use a detailed plain text question as input to the tool.
            """,
        ),
    )
    agent = FunctionCallingAgentWorker(
        tools=[query_engine_tool], llm=Settings.llm, prefix_messages=[]
    ).as_agent()
    return AgentService(
        service_name="context_query_agent",
        agent=agent,
        message_queue=message_queue,
        description="Used to answer the questions using the provided context data.",
    )


def init_control_plane(message_queue: SimpleMessageQueue) -> ControlPlaneServer:
    return ControlPlaneServer(
        message_queue=message_queue,
        orchestrator=AgentOrchestrator(llm=Settings.llm),
    )


def get_launcher():
    message_queue = init_message_queue()
    control_plane = init_control_plane(message_queue)
    context_query_agent = init_agent(message_queue)

    return LocalLauncher(
        services=[context_query_agent],
        control_plane=control_plane,
        message_queue=message_queue,
    )
