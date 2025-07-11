from typing import AsyncGenerator, Union
from llama_index.core.base.llms.types import (
    CompletionResponse,
    CompletionResponseAsyncGen,
    ChatResponse,
)
from llama_index.core.workflow import Context
from llama_index.core.agent.workflow.workflow_events import AgentStream


async def write_response_to_stream(
    res: Union[
        CompletionResponse,
        CompletionResponseAsyncGen,
        AsyncGenerator[ChatResponse, None],
    ],
    ctx: Context,
    current_agent_name: str = "assistant",
) -> str:
    """
    Handle both streaming and non-streaming LLM responses.

    Args:
        res: The LLM response (either streaming or non-streaming)
        ctx: The workflow context for writing events to stream
        current_agent_name: The name of the current agent (default: "assistant")

    Returns:
        The final response text as a string
    """
    final_response = ""

    if isinstance(res, AsyncGenerator):
        # Handle streaming response (CompletionResponseAsyncGen or ChatResponse AsyncGenerator)
        async for chunk in res:
            ctx.write_event_to_stream(
                AgentStream(
                    delta=chunk.delta or "",
                    response=final_response,
                    current_agent_name=current_agent_name,
                    tool_calls=[],
                    raw=getattr(chunk, "raw", None) or "",
                )
            )
            final_response += chunk.delta or ""
    else:
        # Handle non-streaming response (CompletionResponse)
        final_response = res.text

    return final_response
