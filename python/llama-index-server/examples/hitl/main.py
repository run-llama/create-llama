import uuid
from pydantic import Field
import subprocess

from fastapi import FastAPI

# Uncomment this to use the custom workflow
# from custom_workflow import CLIWorkflow
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.workflow import Context, HumanResponseEvent, InputRequiredEvent
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig


class CLIInputRequiredEvent(InputRequiredEvent):
    # TODO: this needs to have a to_response method that sends the event in the right format
    # We don't want this method to be defined here
    """CLIInputRequiredEvent is sent when the agent needs permission from the user to execute the CLI command or not. Render this event by showing the command and a boolean button to execute the command or not."""

    event_component: str = (
        "human_response"  # used to find the right component to render the event
    )
    command: str = Field(description="The command to execute.")


class CLIHumanResponseEvent(HumanResponseEvent):
    execute: bool = Field(
        description="True if the human wants to execute the command, False otherwise."
    )
    command: str = Field(description="The command to execute.")


async def cli_executor(ctx: Context, command: str) -> str:
    """
    This tool carefully waits for user confirmation before executing a command.
    """
    confirmation = await ctx.wait_for_event(
        CLIHumanResponseEvent,
        waiter_id=str(
            uuid.uuid4()
        ),  # ideally not needed, should default to something reasonable
        waiter_event=CLIInputRequiredEvent(  # type: ignore
            command=command,
        ),
    )
    if confirmation.execute:
        return subprocess.check_output(command, shell=True).decode("utf-8")
    else:
        return "Command execution cancelled."


def create_workflow() -> AgentWorkflow:
    # Uncomment this to use the custom workflow
    # return CLIWorkflow()
    return AgentWorkflow.from_tools_or_functions(
        tools_or_functions=[cli_executor],
        llm=OpenAI(model="gpt-4.1-mini"),
        system_prompt="""
        You are a helpful assistant that help the user execute commands.
        You can execute commands using the cli_executor tool, don't need to ask for confirmation for triggering the tool.
        """,
    )


def create_app() -> FastAPI:
    app = LlamaIndexServer(
        workflow_factory=create_workflow,
        ui_config=UIConfig(
            app_title="CLI Assistant",
            starter_questions=[
                "List all files in the current directory",
                "Fetch changes from the remote repository",
            ],
            component_dir="components",
        ),
    )
    return app


# Run command: `uv run fastapi dev`
app = create_app()
