from app.index import get_index
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.llms.openai import OpenAI
from llama_index.server.tools.index import get_query_engine_tool


def create_workflow() -> AgentWorkflow:
    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=[
            get_query_engine_tool(index=get_index()),
        ],
        llm=OpenAI(model="gpt-4o-mini"),
    )
