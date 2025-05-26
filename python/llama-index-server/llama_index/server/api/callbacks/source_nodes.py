from typing import Any, Optional

from llama_index.core.agent.workflow.workflow_events import ToolCallResult
from llama_index.server.api.callbacks.base import EventCallback
from llama_index.server.api.models import SourceNodesEvent


class SourceNodesFromToolCall(EventCallback):
    """
    Extract source nodes from the query tool output.

    Args:
        query_tool_name: The name of the tool that queries the index.
                         default is "query_index"
    """

    def __init__(self, query_tool_name: str = "query_index"):
        self.query_tool_name = query_tool_name

    def transform_tool_call_result(
        self, event: ToolCallResult
    ) -> Optional[SourceNodesEvent]:
        # Check whether result is error
        tool_output = event.tool_output
        if tool_output.is_error:
            return None
        else:
            source_nodes = tool_output.raw_output.source_nodes
            return SourceNodesEvent(nodes=source_nodes)

    async def run(self, event: Any) -> Any:
        if isinstance(event, ToolCallResult):
            if event.tool_name == self.query_tool_name:
                return event, self.transform_tool_call_result(event)
        return event

    @classmethod
    def from_default(cls, *args: Any, **kwargs: Any) -> "SourceNodesFromToolCall":
        return cls()
