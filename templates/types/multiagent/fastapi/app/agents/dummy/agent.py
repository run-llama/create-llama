from llama_agents import AgentService, SimpleMessageQueue
from llama_index.core.agent import FunctionCallingAgentWorker
from llama_index.core.tools import FunctionTool
from llama_index.core.settings import Settings
from app.utils import load_from_env


DEFAULT_DUMMY_AGENT_DESCRIPTION = "I'm a dummy agent which does nothing."


def dummy_function():
    """
    This function does nothing.
    """
    return ""


def init_dummy_agent(message_queue: SimpleMessageQueue) -> AgentService:
    agent = FunctionCallingAgentWorker(
        tools=[FunctionTool.from_defaults(fn=dummy_function)],
        llm=Settings.llm,
        prefix_messages=[],
    ).as_agent()

    return AgentService(
        service_name="dummy_agent",
        agent=agent,
        message_queue=message_queue.client,
        description=load_from_env("AGENT_DUMMY_DESCRIPTION", throw_error=False)
        or DEFAULT_DUMMY_AGENT_DESCRIPTION,
        host=load_from_env("AGENT_DUMMY_HOST", throw_error=False) or "127.0.0.1",
        port=int(load_from_env("AGENT_DUMMY_PORT")),
    )
