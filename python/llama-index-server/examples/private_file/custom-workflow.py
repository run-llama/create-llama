from typing import Any, List

from fastapi import FastAPI

from llama_index.core.agent.workflow.workflow_events import AgentStream
from llama_index.core.llms import LLM
from llama_index.core.prompts import PromptTemplate
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    WorkflowRuntimeError,
    step,
)
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig
from llama_index.server.api.utils.chat_attachments import get_file_attachments
from llama_index.server.models.chat import ChatRequest
from llama_index.server.models.file import ServerFile


class FileHelpEvent(Event):
    """
    The event for helping the user with the an uploaded file.
    """

    file_content: str
    user_request: str


class FileHelpWorkflow(Workflow):
    """
    A simple workflow that helps the user with the an uploaded file.
    Note: The workflow just simply feed all the file content to the LLM so it won't work for large files.
    The purpose is just for demo how a workflow can work with the uploaded file from the user.
    """

    def __init__(
        self,
        llm: LLM,
        file_attachments: List[ServerFile],
        **kwargs: Any,
    ):
        super().__init__(**kwargs)
        self.llm = llm
        self.file_attachments = file_attachments

    @step
    async def read_files(self, ctx: Context, ev: StartEvent) -> FileHelpEvent:
        user_msg = ev.user_msg
        if len(self.file_attachments) == 0:
            raise WorkflowRuntimeError("Please upload one file to start")

        # Read the file content
        last_file = self.file_attachments[-1]
        with open(last_file.path, "r") as f:
            file_content = f.read()

        return FileHelpEvent(
            file_content=file_content,
            user_request=user_msg,
        )

    @step
    async def help_user(self, ctx: Context, ev: FileHelpEvent) -> StopEvent:
        default_prompt = PromptTemplate("""
        You are a writing assistant.
        You are given a file content and a user request.
        Your task is to help the user with the file content.
        
        User request: {user_msg}

        File content:
        {file_content}
        """)
        prompt = default_prompt.format(
            user_msg=ev.user_request,
            file_content=ev.file_content,
        )
        stream = await self.llm.astream_complete(prompt)
        async for chunk in stream:
            ctx.write_event_to_stream(
                AgentStream(
                    response=chunk.text,
                    delta=chunk.delta or "",
                    current_agent_name="agent",
                    tool_calls=[],
                    raw=chunk.raw,
                )
            )

        return StopEvent(
            content=True,
        )


def create_workflow(chat_request: ChatRequest) -> Workflow:
    # Use get_file_attachments to get the file attachments from the chat messages
    file_attachments = get_file_attachments(chat_request.messages)
    return FileHelpWorkflow(
        llm=OpenAI(model="gpt-4.1-mini"),
        file_attachments=file_attachments,
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

    uvicorn.run("custom-workflow:app", host="0.0.0.0", port=8000, reload=True)
