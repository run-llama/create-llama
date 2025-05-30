import subprocess

from events import CLICommand, CLIHumanInputEvent, CLIHumanResponseEvent
from fastapi import FastAPI

from llama_index.core.agent.workflow import AgentWorkflow
from llama_index.core.workflow import Context
from llama_index.llms.openai import OpenAI
from llama_index.server import LlamaIndexServer, UIConfig


async def cli_executor(ctx: Context, command: str) -> str:
    """
    This tool carefully waits for user confirmation before executing a command.
    """
    confirmation = await ctx.wait_for_event(
        CLIHumanResponseEvent,
        waiter_event=CLIHumanInputEvent(
            data=CLICommand(command=command),
        ),
    )
    if confirmation.execute:
        return subprocess.check_output(confirmation.command, shell=True).decode("utf-8")
    else:
        return "Command execution cancelled."


def create_workflow() -> AgentWorkflow:
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


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("agent_workflow:app", port=8000, reload=True)
