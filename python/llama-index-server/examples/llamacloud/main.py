import os
from typing import Optional

from fastapi import FastAPI
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig
from llama_index.server.api.models import ChatRequest
from llama_index.server.services.llamacloud import get_index
from llama_index.server.tools.index import get_query_engine_tool

# Please set the following environment variables to use LlamaCloud
if os.getenv("LLAMA_CLOUD_API_KEY") is None:
    raise ValueError("LLAMA_CLOUD_API_KEY is not set")
if os.getenv("LLAMA_CLOUD_PROJECT_NAME") is None:
    raise ValueError("LLAMA_CLOUD_PROJECT_NAME is not set")
if os.getenv("LLAMA_CLOUD_INDEX_NAME") is None:
    raise ValueError("LLAMA_CLOUD_INDEX_NAME is not set")


def create_workflow(chat_request: Optional[ChatRequest] = None) -> AgentWorkflow:
    index = get_index(chat_request=chat_request)
    if index is None:
        raise RuntimeError("Index not found!")
    # Create a query tool with citations enabled
    query_tool = get_query_engine_tool(index=index, enable_citation=True)
    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=[query_tool],
        llm=OpenAI(model="gpt-4o"),
        system_prompt="You are a helpful assistant.",
    )


def create_app() -> FastAPI:
    app = LlamaIndexServer(
        workflow_factory=create_workflow,
        env="dev",
        suggest_next_questions=False,
        ui_config=UIConfig(
            llamacloud_index_selector=True,  # to select different indexes in the UI
        ),
    )
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
