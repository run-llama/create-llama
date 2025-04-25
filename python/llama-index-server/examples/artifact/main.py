from fastapi import FastAPI

from examples.artifact.code_workflow import ArtifactWorkflow

# To use document artifact workflow, uncomment the following line
# from examples.artifact.document_workflow import ArtifactWorkflow
from llama_index.core.workflow import Workflow
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig
from llama_index.server.api.models import ChatRequest


def create_workflow(chat_request: ChatRequest) -> Workflow:
    workflow = ArtifactWorkflow(
        llm=OpenAI(model="gpt-4.1"),
        chat_request=chat_request,
        timeout=120.0,
    )
    return workflow


def create_app() -> FastAPI:
    app = LlamaIndexServer(
        workflow_factory=create_workflow,
        ui_config=UIConfig(
            app_title="Artifact",
            starter_questions=[
                "Write a simple calculator app",
                "Write a guideline on how to use LLM effectively",
            ],
            component_dir="components",
        ),
    )
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
