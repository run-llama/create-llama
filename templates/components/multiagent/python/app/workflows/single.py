from abc import abstractmethod
from typing import Any, List, Optional

from llama_index.core.base.llms.types import ChatMessage
from llama_index.core.llms import ChatResponse
from llama_index.core.llms.function_calling import FunctionCallingLLM
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.settings import Settings
from llama_index.core.tools import FunctionTool, ToolOutput, ToolSelection
from llama_index.core.tools.types import BaseTool
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)
from pydantic import BaseModel

from .helper import AgentRunEvent, tool_caller


class InputEvent(Event):
    input: list[ChatMessage]


class ToolCallEvent(Event):
    tool_calls: list[ToolSelection]


class AgentRunResult(BaseModel):
    response: ChatResponse
    sources: list[ToolOutput]


class ContextAwareTool(FunctionTool):
    @abstractmethod
    async def acall(self, ctx: Context, input: Any) -> ToolOutput:  # type: ignore
        pass


class FunctionCallingAgent(Workflow):
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
        description: str | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(*args, verbose=verbose, timeout=timeout, **kwargs)  # type: ignore
        self.tools = tools or []
        self.name = name
        self.write_events = write_events
        self.description = description

        if llm is None:
            llm = Settings.llm
        self.llm = llm
        assert self.llm.metadata.is_function_calling_model

        self.system_prompt = system_prompt

        self.memory = ChatMemoryBuffer.from_defaults(
            llm=self.llm, chat_history=chat_history
        )
        self.sources = []  # type: ignore

    @step()
    async def prepare_chat_history(self, ctx: Context, ev: StartEvent) -> InputEvent:
        # clear sources
        self.sources = []

        # set system prompt
        if self.system_prompt is not None:
            system_msg = ChatMessage(role="system", content=self.system_prompt)
            self.memory.put(system_msg)

        # set streaming
        ctx.data["streaming"] = getattr(ev, "streaming", False)

        # get user input
        user_input = ev.input
        user_msg = ChatMessage(role="user", content=user_input)
        self.memory.put(user_msg)
        if self.write_events:
            ctx.write_event_to_stream(
                AgentRunEvent(name=self.name, msg=f"Start to work on: {user_input}")
            )

        # get chat history
        chat_history = self.memory.get()
        return InputEvent(input=chat_history)

    @step()
    async def handle_llm_input(
        self,
        ctx: Context,
        ev: InputEvent,
    ) -> ToolCallEvent | StopEvent:
        chat_history = ev.input

        tool_calls, response = await self.tool_calls_or_response(chat_history)
        if tool_calls is None:
            if ctx.data["streaming"]:
                return StopEvent(result=response)
            else:
                full_response = await response.__anext__()
                result = AgentRunResult(
                    response=full_response,
                    sources=[],
                )
                return StopEvent(result=result)
        else:
            self.memory.put(response.message)
            return ToolCallEvent(tool_calls=tool_calls)

    @step()
    async def handle_tool_calls(self, ctx: Context, ev: ToolCallEvent) -> InputEvent:
        tool_calls = ev.tool_calls

        generator = tool_caller(self.name, self.tools, ctx, tool_calls)
        async for response in generator:
            if isinstance(response, AgentRunEvent) and self.write_events:
                ctx.write_event_to_stream(response)
            else:
                for msg in response:
                    self.memory.put(msg)
        return InputEvent(input=self.memory.get())
