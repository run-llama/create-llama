from typing import Any, Dict, Optional

from llama_index.core.agent.workflow.workflow_events import ToolCall
from llama_index.server.api.callbacks.base import EventCallback


class AgentEventFromToolCall(EventCallback):
    """
    Extract agent event from the tool call input.

    Args:
        tool_name: The name of the tool that queries the index.
    """

    def transform_tool_call_input_to_agent_event(
        self, event: ToolCall
    ) -> Optional[Dict[str, Any]]:
        # Only transform tool call input
        if hasattr(event, "tool_kwargs") and not hasattr(event, "tool_output"):
            return {
                "type": "agent",
                "data": {
                    "agent": "Agent",
                    "text": f"Call tool {event.tool_name} with input {str(event.tool_kwargs)}.",
                },
            }
        return None

    async def run(self, event: Any) -> Any:
        if isinstance(event, ToolCall):
            return event, self.transform_tool_call_input_to_agent_event(event)
        return event

    @classmethod
    def from_default(cls, *args: Any, **kwargs: Any) -> "AgentEventFromToolCall":
        return cls()
