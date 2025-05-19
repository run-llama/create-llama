import hashlib
import subprocess

from fastapi import FastAPI

# Uncomment this to use the custom workflow
# from custom_workflow import CLIWorkflow
from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.workflow import Context, HumanResponseEvent, InputRequiredEvent
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig


async def cli_executor(ctx: Context, command: str) -> str:
    """
    This tool carefully waits for user confirmation before executing a command.
    """
    # hash command into an unique id for the waiter
    command_id = hashlib.sha256(command.encode("utf-8")).hexdigest()
    confirmation = await ctx.wait_for_event(
        HumanResponseEvent,
        waiter_id=command_id,
        waiter_event=InputRequiredEvent(  # type: ignore
            prefix=f"Do you wanna execute command: `{command}`?",
        ),
    )
    if confirmation.response.lower().strip() == "yes":
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
            app_title="Artifact",
            starter_questions=[
                "List all files in the current directory",
                "Fetch changes from the remote repository",
            ],
        ),
    )
    return app


# Run command: `uv run fastapi dev`
app = create_app()
