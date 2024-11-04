import uuid
from abc import abstractmethod
from enum import Enum
from typing import Any, AsyncGenerator, List, Optional

from llama_index.core.base.llms.types import ChatMessage, MessageRole
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
from pydantic import BaseModel, Field


class InputEvent(Event):
    input: list[ChatMessage]


class ToolCallEvent(Event):
    tool_calls: list[ToolSelection]


class AgentRunEventType(Enum):
    TEXT = "text"
    PROGRESS = "progress"


class AgentRunEvent(Event):
    name: str
    msg: str
    event_type: AgentRunEventType = Field(default=AgentRunEventType.TEXT)
    data: Optional[dict] = None

    def to_response(self) -> dict:
        return {
            "type": "agent",
            "data": {
                "agent": self.name,
                "type": self.event_type.value,
                "text": self.msg,
                "data": self.data,
            },
        }


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
            return StopEvent(result=response)
        else:
            self.memory.put(response.message)
            return ToolCallEvent(tool_calls=tool_calls)

    @step()
    async def handle_tool_calls(self, ctx: Context, ev: ToolCallEvent) -> InputEvent:
        tool_calls = ev.tool_calls

        tool_caller = self.tool_caller(ctx, tool_calls)

        async for response in tool_caller:
            if isinstance(response, AgentRunEvent) and self.write_events:
                ctx.write_event_to_stream(response)
            else:
                for msg in response:
                    self.memory.put(msg)
        return InputEvent(input=self.memory.get())

    async def tool_caller(
        self,
        ctx: Optional[Context],
        tool_calls: list[ToolSelection],
    ) -> AsyncGenerator[AgentRunEvent | list[ChatMessage], None]:
        tools_by_name = {tool.metadata.get_name(): tool for tool in self.tools}
        tool_msgs: list[ChatMessage] = []

        # call tools -- safely!
        # If there are multiple tool calls
        # Show the progress
        progress_id = str(uuid.uuid4())
        total_steps = len(tool_calls)
        show_progress = total_steps > 1
        if show_progress:
            yield AgentRunEvent(
                name=self.name,
                msg=f"Making {total_steps} tool calls",
            )
        for i, tool_call in enumerate(tool_calls):
            tool = tools_by_name.get(tool_call.tool_name)
            additional_kwargs = {
                "tool_call_id": tool_call.tool_id,
                "name": tool.metadata.get_name(),
            }
            if not tool:
                tool_msgs.append(
                    ChatMessage(
                        role=MessageRole.ASSISTANT,
                        content=f"Tool {tool_call.tool_name} does not exist",
                        additional_kwargs=additional_kwargs,
                    )
                )
                continue
            try:
                if show_progress:
                    yield AgentRunEvent(
                        name=self.name,
                        msg=f"Calling tool {tool_call.tool_name}, {tool_call.tool_kwargs}",
                        event_type=AgentRunEventType.PROGRESS,
                        data={
                            "id": progress_id,
                            "total": total_steps,
                            "current": i,
                        },
                    )
                else:
                    yield AgentRunEvent(
                        name=self.name,
                        msg=f"Calling tool {tool_call.tool_name}, {str(tool_call.tool_kwargs)}",
                    )
                if isinstance(tool, ContextAwareTool):
                    if ctx is None:
                        raise ValueError("Context is required for context aware tool")
                    # inject context for calling an context aware tool
                    response = await tool.acall(ctx=ctx, **tool_call.tool_kwargs)
                else:
                    response = await tool.acall(**tool_call.tool_kwargs)  # type: ignore
                tool_msgs.append(
                    ChatMessage(
                        role=MessageRole.TOOL,
                        content=str(response.raw_output),
                        additional_kwargs=additional_kwargs,
                    )
                )
            except Exception as e:
                # Print trace back here
                tool_msg = ChatMessage(
                    role=MessageRole.TOOL,
                    content=f"Error: {str(e)}",
                    additional_kwargs=additional_kwargs,
                )
                yield AgentRunEvent(
                    name=self.name,
                    msg=f"Error in tool {tool_call.tool_name}: {str(e)}",
                )
                tool_msgs.append(tool_msg)
        if show_progress:
            yield AgentRunEvent(
                name=self.name,
                msg="Task finished",
            )

        yield tool_msgs

    async def tool_calls_or_response(
        self,
        chat_history: list[ChatMessage],
    ) -> tuple[
        list[ToolSelection] | None, AsyncGenerator[ChatMessage, None] | ChatMessage
    ]:
        """
        Request LLM to call tools or not.
        This function doesn't change the memory.
        """
        generator = self.tool_call_generator(chat_history)
        is_tool_call = await generator.__anext__()
        if is_tool_call:
            async for chunk in generator:
                full_response = chunk
            tool_calls = self.llm.get_tool_calls_from_response(full_response)  # type: ignore
            return tool_calls, full_response
        else:
            return None, generator

    async def tool_call_generator(
        self,
        chat_history: list[ChatMessage],
    ) -> AsyncGenerator[ChatMessage | bool, None]:
        response_stream = await self.llm.astream_chat_with_tools(
            self.tools,
            chat_history=chat_history,
            allow_parallel_tool_calls=True,
        )

        full_response = None
        yielded_indicator = False
        async for chunk in response_stream:
            if "tool_calls" not in chunk.message.additional_kwargs:
                # Yield a boolean to indicate whether the response is a tool call
                if not yielded_indicator:
                    yield False
                    yielded_indicator = True

                # if not a tool call, yield the chunks!
                yield chunk  # type: ignore
            elif not yielded_indicator:
                # Yield the indicator for a tool call
                yield True
                yielded_indicator = True

            full_response = chunk

        # Write the full response to memory and yield it
        if full_response:
            yield full_response  # type: ignore
