from typing import Optional

from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.llms.openai import OpenAI
from llama_index.server.models import ChatRequest


def create_workflow(chat_request: Optional[ChatRequest] = None) -> AgentWorkflow:
    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=[],
        llm=OpenAI(model="gpt-4o-mini"),
        system_prompt="You are a helpful assistant that can tell a joke about Llama.",
    )
