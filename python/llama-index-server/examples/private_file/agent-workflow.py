import json
from typing import Optional

from fastapi import FastAPI

from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.settings import Settings
from llama_index.core.tools import FunctionTool
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig
from llama_index.server.api.utils.chat_attachments import get_file_attachments
from llama_index.server.models import ChatRequest
from llama_index.server.services.file import FileService


def create_file_tool(chat_request: ChatRequest) -> Optional[FunctionTool]:
    """
    Create a tool to read file if the user uploads a file.
    """
    file_ids = []
    for file in get_file_attachments(chat_request.messages):
        file_ids.append(file.id)
    if len(file_ids) == 0:
        return None

    file_tool_description = (
        "Use this tool with a file id to read the content of the file."
        f"\nYou only have access to the following file ids: {json.dumps(file_ids)}"
    )

    def read_file(file_id: str) -> str:
        file_path = FileService.get_file_path(file_id)
        try:
            with open(file_path, "r") as file:
                return file.read()
        except Exception as e:
            return f"Error reading file {file_path}: {e}"

    return FunctionTool.from_defaults(
        fn=read_file,
        name="read_file",
        description=file_tool_description,
    )


def create_workflow(chat_request: ChatRequest) -> AgentWorkflow:
    file_tool = create_file_tool(chat_request)
    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=[file_tool] if file_tool else [],
        llm=Settings.llm or OpenAI(model="gpt-4.1-mini"),
        system_prompt="You are a helpful assistant that can help users with their uploaded files.",
    )


def create_app() -> FastAPI:
    app = LlamaIndexServer(
        workflow_factory=create_workflow,
        suggest_next_questions=False,
        ui_config=UIConfig(
            enable_file_upload=True,
            component_dir="components",
        ),
    )
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("agent-workflow:app", host="0.0.0.0", port=8000, reload=True)
