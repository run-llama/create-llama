from app.workflow import create_workflow
from fastapi import FastAPI

from llama_index.server import LlamaIndexServer, UIConfig


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

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
