import hashlib
import subprocess
from typing import Type

from fastapi import FastAPI
from pydantic import BaseModel, Field

# Uncomment this to use the custom workflow
# from custom_workflow import CLIWorkflow
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.workflow import Context, Event
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig
from llama_index.server.api.models import HumanInputEvent


class CLIHumanResponseEvent(Event):
    execute: bool = Field(
        description="True if the human wants to execute the command, False otherwise."
    )
    command: str = Field(description="The command to execute.")


class CLICommand(BaseModel):
    command: str = Field(description="The command to execute.")


# We need an event that extends from HumanInputEvent for HITL feature
class CLIHumanInputEvent(HumanInputEvent):
    """
    CLIInputRequiredEvent is sent when the agent needs permission from the user to execute the CLI command or not.
    Render this event by showing the command and a boolean button to execute the command or not.
    """

    event_type: str = (
        "cli_human_input"  # used by UI to render with appropriate component
    )
    response_event_type: Type = (
        CLIHumanResponseEvent  # used by workflow to resume with the correct event
    )
    data: CLICommand = Field(  # the data that sent to the UI for rendering
        description="The command to execute.",
    )


async def cli_executor(ctx: Context, command: str) -> str:
    """
    This tool carefully waits for user confirmation before executing a command.
    """
    # a unique id as a flag for the waiter
    # simply hash this function name and the parameters as a unique id
    # TODO: can add a decorator to generate the waiter_id
    waiter_id = hashlib.sha256(f"cli_executor:{command}".encode("utf-8")).hexdigest()
    try:
        input_event = CLIHumanInputEvent(
            data=CLICommand(command=command),
        )
    except Exception as e:
        print("Error", e)
        return "Command execution cancelled."
    confirmation = await ctx.wait_for_event(
        CLIHumanResponseEvent,
        waiter_id=waiter_id,
        waiter_event=input_event,
    )
    if confirmation.execute:
        return subprocess.check_output(confirmation.command, shell=True).decode("utf-8")
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
        suggest_next_questions=False,
        ui_config=UIConfig(
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
