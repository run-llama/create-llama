import platform
import subprocess
from typing import Any

from llama_index.core.prompts import PromptTemplate
from llama_index.core.settings import Settings
from llama_index.core.workflow import (
    Context,
    Event,
    HumanResponseEvent,
    InputRequiredEvent,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)


class CLIExecutionEvent(Event):
    command: str


class CLIWorkflow(Workflow):
    """
    A workflow has ability to execute command line tool.
    """

    default_prompt = PromptTemplate(
        template="""
        You are a helpful assistant who can write CLI commands to execute using {cli_language}.
        Your task is to analyze the user's request and write a CLI command to execute.

        ## User Request
        {user_request}

        Don't be verbose, only respond with the CLI command without any other text.
        """
    )

    def __init__(self, **kwargs: Any) -> None:
        # HITL Workflow should disable timeout otherwise, we will get a timeout error from callback
        kwargs["timeout"] = None
        super().__init__(**kwargs)

    @step
    async def start(self, ctx: Context, ev: StartEvent) -> InputRequiredEvent:
        user_msg = ev.user_msg
        if user_msg is None:
            raise ValueError("Missing user_msg in StartEvent")
        await ctx.set("user_msg", user_msg)
        # Get current operating system and CLI language
        os_name = platform.system()
        if os_name == "Linux" or os_name == "Darwin":
            cli_language = "bash"
        else:
            cli_language = "cmd"
        prompt = self.default_prompt.format(
            user_request=user_msg, cli_language=cli_language
        )
        llm = Settings.llm
        if llm is None:
            raise ValueError("Missing LLM in Settings")
        response = await llm.acomplete(prompt, formatted=True)
        command = response.text.strip()
        if command == "":
            raise ValueError("Couldn't generate a command")
        await ctx.set("command", command)
        return InputRequiredEvent(  # type: ignore
            prefix=f"Do you wanna execute command: `{command}`?",
            command=command,
        )

    @step
    async def handle_human_response(
        self, ctx: Context, ev: HumanResponseEvent
    ) -> StopEvent | CLIExecutionEvent:
        if ev.response.lower().strip() == "yes":
            return CLIExecutionEvent(
                command=await ctx.get("command"),
            )
        else:
            return StopEvent(result=None)

    @step
    async def cli_execution(self, ctx: Context, ev: CLIExecutionEvent) -> StopEvent:
        command = ev.command or ""
        if command == "":
            raise ValueError("Missing command in CLIExecutionEvent")
        res = subprocess.run(command, shell=True, capture_output=True, text=True)
        return StopEvent(result=res.stdout)
