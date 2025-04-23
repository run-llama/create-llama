from typing import List

from fastapi import FastAPI

from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.tools import BaseTool
from llama_index.core.workflow import Workflow
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig
from llama_index.server.api.models import ChatRequest
from llama_index.server.api.utils import get_last_artifact
from llama_index.server.tools.artifact_generator import ArtifactGenerator


def create_workflow(chat_request: ChatRequest) -> Workflow:
    tools: List[BaseTool] = [
        ArtifactGenerator(
            last_artifact=get_last_artifact(chat_request),
            llm=OpenAI(model="gpt-4.1"),
        ).to_tool()
    ]
    agent = AgentWorkflow.from_tools_or_functions(
        tools,  # type: ignore
        llm=OpenAI(model="gpt-4.1-mini"),
        system_prompt="You are a helpful assistant that can generate artifacts (code or markdown document), use the provided tools to respond to the user's request.",
    )
    return agent


def create_app() -> FastAPI:
    app = LlamaIndexServer(
        workflow_factory=create_workflow,
        ui_config=UIConfig(
            app_title="App Writer",
        ),
    )
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app_writer:app", host="0.0.0.0", port=8000, reload=True)
