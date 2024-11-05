import uuid
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, AsyncGenerator, Callable, Optional

from llama_index.core.base.llms.types import ChatMessage, ChatResponse, MessageRole
from llama_index.core.llms.function_calling import FunctionCallingLLM
from llama_index.core.tools import (
    BaseTool,
    FunctionTool,
    ToolMetadata,
    ToolOutput,
    ToolSelection,
)
from llama_index.core.workflow import Context, Event


class ContextAwareTool(FunctionTool, ABC):
    @abstractmethod
    async def acall(self, ctx: Context, input: Any) -> ToolOutput:  # type: ignore
        pass


class AgentRunEventType(Enum):
    TEXT = "text"
    PROGRESS = "progress"


class AgentRunEvent(Event):
    name: str
    msg: str
    event_type: AgentRunEventType = AgentRunEventType.TEXT
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


async def workflow_step_as_tool(step: Callable) -> FunctionTool:
    """
    Construct a step as a tool to passing to the agent.
    """
    step_description = step.__doc__ or step.__name__
    tool = FunctionTool(
        fn=step,
        metadata=ToolMetadata(
            name=step.__name__,
            description=step_description,
        ),
    )
    return tool


async def call_tools(
    ctx: Context,
    agent_name: str,
    tools: list[BaseTool],
    tool_calls: list[ToolSelection],
    emit_agent_events: bool = True,
) -> list[ChatMessage]:
    tools_by_name = {tool.metadata.get_name(): tool for tool in tools}
    tool_msgs: list[ChatMessage] = []

    # call tools -- safely!
    # If there are multiple tool calls, show the progress
    progress_id = str(uuid.uuid4())
    total_steps = len(tool_calls)
    show_progress = total_steps > 1
    if show_progress and emit_agent_events:
        ctx.write_event_to_stream(
            AgentRunEvent(
                name=agent_name,
                msg=f"Making {total_steps} tool calls",
            )
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
            if show_progress and emit_agent_events:
                ctx.write_event_to_stream(
                    AgentRunEvent(
                        name=agent_name,
                        msg=f"Calling tool {tool_call.tool_name}, {tool_call.tool_kwargs}",
                        event_type=AgentRunEventType.PROGRESS,
                        data={
                            "id": progress_id,
                            "total": total_steps,
                            "current": i,
                        },
                    )
                )
            else:
                ctx.write_event_to_stream(
                    AgentRunEvent(
                        name=agent_name,
                        msg=f"Calling tool {tool_call.tool_name}, {str(tool_call.tool_kwargs)}",
                    )
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
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name=agent_name,
                    msg=f"Error in tool {tool_call.tool_name}: {str(e)}",
                )
            )
            tool_msgs.append(tool_msg)
    if show_progress and emit_agent_events:
        ctx.write_event_to_stream(
            AgentRunEvent(
                name=agent_name,
                msg="Task finished",
            )
        )

    return tool_msgs


async def tool_calls_or_response(  # type: ignore
    llm: FunctionCallingLLM,
    tools: list[BaseTool],
    chat_history: list[ChatMessage],
) -> tuple[
    list[ToolSelection] | None, AsyncGenerator[ChatMessage, None] | ChatResponse
]:
    """
    Request LLM to call tools or not.
    This function doesn't change the memory.
    """
    generator = _tool_call_generator(llm, tools, chat_history)
    is_tool_call = await generator.__anext__()
    if is_tool_call:
        async for chunk in generator:
            full_response = chunk
        tool_calls = llm.get_tool_calls_from_response(full_response)
        return tool_calls, full_response
    else:
        return None, generator


async def _tool_call_generator(
    llm: FunctionCallingLLM,
    tools: list[BaseTool],
    chat_history: list[ChatMessage],
) -> AsyncGenerator[ChatMessage | bool, None]:
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

    # Write the full response to memory and yield it
    if full_response:
        yield full_response  # type: ignore
