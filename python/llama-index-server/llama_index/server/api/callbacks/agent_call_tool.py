import logging
from typing import Any

from llama_index.core.agent.workflow.workflow_events import ToolCall, ToolCallResult
from llama_index.server.api.callbacks.base import EventCallback
from llama_index.server.models.ui import AgentRunEvent

logger = logging.getLogger("uvicorn")


class AgentCallTool(EventCallback):
    """
    Adapter for convert tool call events to agent run events.
    """

    async def run(self, event: Any) -> Any:
        if isinstance(event, ToolCall) and not isinstance(event, ToolCallResult):
            return AgentRunEvent(
                name="Agent",
                msg=f"Calling tool: {event.tool_name} with: {event.tool_kwargs}",
            )
        return event

    @classmethod
    def from_default(cls, *args: Any, **kwargs: Any) -> "AgentCallTool":
        return cls()
