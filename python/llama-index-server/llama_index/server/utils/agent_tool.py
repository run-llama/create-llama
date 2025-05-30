import logging
import uuid
from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Optional

from pydantic import BaseModel, ConfigDict

from llama_index.core.base.llms.types import ChatMessage, ChatResponse
from llama_index.core.llms.function_calling import FunctionCallingLLM
from llama_index.core.tools import (
    BaseTool,
    FunctionTool,
    ToolOutput,
    ToolSelection,
)
from llama_index.core.workflow import Context
from llama_index.server.models.ui import AgentRunEvent, AgentRunEventType
from llama_index.core.agent.workflow.workflow_events import ToolCall, ToolCallResult

logger = logging.getLogger("uvicorn")


class ToolCallOutput(BaseModel):
    tool_call_id: str
    tool_output: ToolOutput


class ContextAwareTool(FunctionTool, ABC):
    @abstractmethod
    async def acall(self, ctx: Context, input: Any) -> ToolOutput:  # type: ignore
        pass


class ChatWithToolsResponse(BaseModel):
    """
    A tool call response from chat_with_tools.
    """

    tool_calls: Optional[list[ToolSelection]]
    tool_call_message: Optional[ChatMessage]
    generator: Optional[AsyncGenerator[ChatResponse | None, None]]

    model_config = ConfigDict(arbitrary_types_allowed=True)

    def is_calling_different_tools(self) -> bool:
        tool_names = {tool_call.tool_name for tool_call in self.tool_calls or []}
        return len(tool_names) > 1

    def has_tool_calls(self) -> bool:
        return self.tool_calls is not None and len(self.tool_calls) > 0

    def tool_name(self) -> str:
        if not self.has_tool_calls():
            raise ValueError("No tool calls")
        if self.is_calling_different_tools():
            raise ValueError("Calling different tools")
        return self.tool_calls[0].tool_name  # type: ignore

    async def full_response(self) -> str:
        assert self.generator is not None
        full_response = ""
        async for chunk in self.generator:
            content = chunk.delta  # type: ignore
            if content:
                full_response += content
        return full_response


async def chat_with_tools(  # type: ignore
    llm: FunctionCallingLLM,
    tools: list[BaseTool],
    chat_history: list[ChatMessage],
) -> ChatWithToolsResponse:
    """
    Request LLM to call tools or not.
    This function doesn't change the memory.
    """
    generator = _tool_call_generator(llm, tools, chat_history)
    is_tool_call = await generator.__anext__()
    if is_tool_call:
        # Last chunk is the full response
        # Wait for the last chunk
        full_response = None
        async for chunk in generator:
            full_response = chunk
        assert isinstance(full_response, ChatResponse)
        return ChatWithToolsResponse(
            tool_calls=llm.get_tool_calls_from_response(full_response),
            tool_call_message=full_response.message,
            generator=None,
        )
    else:
        return ChatWithToolsResponse(
            tool_calls=None,
            tool_call_message=None,
            generator=generator,  # type: ignore
        )


async def call_tools(
    ctx: Context,
    agent_name: str,
    tools: list[BaseTool],
    tool_calls: list[ToolSelection],
    emit_agent_events: bool = True,
) -> list[ToolCallOutput]:
    """
    Call tools and return the tool call responses.
    """
    if len(tool_calls) == 0:
        return []
    tools_by_name = {tool.metadata.get_name(): tool for tool in tools}
    if len(tool_calls) == 1:
        if emit_agent_events:
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name=agent_name,
                    msg=f"{tool_calls[0].tool_name}: {tool_calls[0].tool_kwargs}",
                )
            )
        return [
            await call_tool(ctx, tools_by_name[tool_calls[0].tool_name], tool_calls[0])
        ]
    # Multiple tool calls, show progress
    tool_call_outputs: list[ToolCallOutput] = []

    progress_id = str(uuid.uuid4())
    total_steps = len(tool_calls)
    if emit_agent_events:
        ctx.write_event_to_stream(
            AgentRunEvent(
                name=agent_name,
                msg=f"Making {total_steps} tool calls",
            )
        )
    for i, tool_call in enumerate(tool_calls):
        tool = tools_by_name.get(tool_call.tool_name)
        if not tool:
            tool_call_outputs.append(
                ToolCallOutput(
                    tool_call_id=tool_call.tool_id,
                    tool_output=ToolOutput(
                        is_error=True,
                        content=f"Tool {tool_call.tool_name} does not exist",
                        tool_name=tool_call.tool_name,
                        raw_input=tool_call.tool_kwargs,
                        raw_output={
                            "error": f"Tool {tool_call.tool_name} does not exist",
                        },
                    ),
                )
            )
            continue

        tool_call_output = await call_tool(
            ctx,
            tool,
            tool_call,
        )
        if emit_agent_events:
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name=agent_name,
                    msg=f"{tool_call.tool_name}: {tool_call.tool_kwargs}",
                    event_type=AgentRunEventType.PROGRESS,
                    data={
                        "id": progress_id,
                        "total": total_steps,
                        "current": i,
                    },
                )
            )
        tool_call_outputs.append(tool_call_output)
    return tool_call_outputs


async def call_tool(
    ctx: Context,
    tool: BaseTool,
    tool_call: ToolSelection,
) -> ToolCallOutput:
    ctx.write_event_to_stream(
        ToolCall(
            tool_name=tool_call.tool_name,
            tool_id=tool_call.tool_id,
            tool_kwargs=tool_call.tool_kwargs,
        )
    )
    try:
        if isinstance(tool, ContextAwareTool):
            if ctx is None:
                raise ValueError("Context is required for context aware tool")
            # inject context for calling an context aware tool
            output = await tool.acall(ctx=ctx, **tool_call.tool_kwargs)
        else:
            output = await tool.acall(**tool_call.tool_kwargs)  # type: ignore
    except Exception as e:
        logger.error(f"Got error in tool {tool_call.tool_name}: {e!s}")
        output = ToolOutput(
            is_error=True,
            content=f"Error: {e!s}",
            tool_name=tool.metadata.get_name(),
            raw_input=tool_call.tool_kwargs,
            raw_output={
                "error": str(e),
            },
        )
    ctx.write_event_to_stream(
        ToolCallResult(
            tool_name=tool_call.tool_name,
            tool_kwargs=tool_call.tool_kwargs,
            tool_id=tool_call.tool_id,
            tool_output=output,
            return_direct=False,
        )
    )
    return ToolCallOutput(
        tool_call_id=tool_call.tool_id,
        tool_output=output,
    )


async def _tool_call_generator(
    llm: FunctionCallingLLM,
    tools: list[BaseTool],
    chat_history: list[ChatMessage],
) -> AsyncGenerator[ChatResponse | bool, None]:
    response_stream = await llm.astream_chat_with_tools(
        tools,
        chat_history=chat_history,
        allow_parallel_tool_calls=False,
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

    if full_response:
        yield full_response  # type: ignore
