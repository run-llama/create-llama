from typing import Any, List, Optional

from app.workflows.events import AgentRunEvent
from app.workflows.tools import ToolCallResponse, call_tools, chat_with_tools
from llama_index.core.base.llms.types import ChatMessage
from llama_index.core.llms.function_calling import FunctionCallingLLM
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.settings import Settings
from llama_index.core.tools.types import BaseTool
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)


class InputEvent(Event):
    input: list[ChatMessage]


class ToolCallEvent(Event):
    input: ToolCallResponse


class FunctionCallingAgent(Workflow):
    """
    A simple workflow to request LLM with tools independently.
    You can share the previous chat history to provide the context for the LLM.
    """

    def __init__(
        self,
        *args: Any,
        llm: FunctionCallingLLM | None = None,
        chat_history: Optional[List[ChatMessage]] = None,
        tools: List[BaseTool] | None = None,
        system_prompt: str | None = None,
        verbose: bool = False,
        timeout: float = 360.0,
        name: str,
        write_events: bool = True,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, verbose=verbose, timeout=timeout, **kwargs)  # type: ignore
        self.tools = tools or []
        self.name = name
        self.write_events = write_events

        if llm is None:
            llm = Settings.llm
        self.llm = llm
        if not self.llm.metadata.is_function_calling_model:
            raise ValueError("The provided LLM must support function calling.")

        self.system_prompt = system_prompt

        self.memory = ChatMemoryBuffer.from_defaults(
            llm=self.llm, chat_history=chat_history
        )
        self.sources = []  # type: ignore

    @step()
    async def prepare_chat_history(self, ctx: Context, ev: StartEvent) -> InputEvent:
        # clear sources
        self.sources = []

        # set streaming
        ctx.data["streaming"] = getattr(ev, "streaming", False)

        # set system prompt
        if self.system_prompt is not None:
            system_msg = ChatMessage(role="system", content=self.system_prompt)
            self.memory.put(system_msg)

        # get user input
        user_input = ev.input
        user_msg = ChatMessage(role="user", content=user_input)
        self.memory.put(user_msg)

        if self.write_events:
            ctx.write_event_to_stream(
                AgentRunEvent(name=self.name, msg=f"Start to work on: {user_input}")
            )

        return InputEvent(input=self.memory.get())

    @step()
    async def handle_llm_input(
        self,
        ctx: Context,
        ev: InputEvent,
    ) -> ToolCallEvent | StopEvent:
        chat_history = ev.input

        response = await chat_with_tools(
            self.llm,
            self.tools,
            chat_history,
        )
        is_tool_call = isinstance(response, ToolCallResponse)
        if not is_tool_call:
            if ctx.data["streaming"]:
                return StopEvent(result=response)
            else:
                full_response = ""
                async for chunk in response.generator:
                    full_response += chunk.message.content
                return StopEvent(result=full_response)
        return ToolCallEvent(input=response)

    @step()
    async def handle_tool_calls(self, ctx: Context, ev: ToolCallEvent) -> InputEvent:
        tool_calls = ev.input.tool_calls
        tool_call_message = ev.input.tool_call_message
        self.memory.put(tool_call_message)
        tool_messages = await call_tools(self.name, self.tools, ctx, tool_calls)
        self.memory.put_messages(tool_messages)
        return InputEvent(input=self.memory.get())
