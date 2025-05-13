from typing import Optional

from fastapi import FastAPI

from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.settings import Settings
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig
from llama_index.server.api.models import ChatRequest


def create_workflow(chat_request: Optional[ChatRequest] = None) -> AgentWorkflow:
    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=[],
        llm=Settings.llm or OpenAI(model="gpt-4o-mini"),
        system_prompt="You are a helpful assistant that can tell a joke.",
    )


def create_app() -> FastAPI:
    app = LlamaIndexServer(
        workflow_factory=create_workflow,
        ui_config=UIConfig(
            app_title="Artifact",
            starter_questions=[
                "Tell me a funny joke.",
                "Tell me some jokes about AI.",
            ],
            component_dir="components",
            dev_mode=True,  # To show the dev UI, should disable this in production
        ),
    )
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("workflow:app", host="0.0.0.0", port=8000, reload=True)
