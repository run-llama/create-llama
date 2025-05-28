import logging
from typing import Any, List, Optional

from llama_index.core.agent.workflow.workflow_events import ToolCallResult
from llama_index.server.api.callbacks.base import EventCallback
from llama_index.server.api.models import SourceNodesEvent

logger = logging.getLogger(__name__)


class SourceNodesFromToolCall(EventCallback):
    """
    Extract source nodes from the query tool output.

    Args:
        tool_suffixes: The suffixes of the tool names that queries the index.
                       default is ["query_engine", "query_index"]
        tool_name: The name of the tool that queries the index.
                   default is None
    """

    def __init__(
        self,
        tool_suffixes: List[str] = [
            "query_engine",
            "query_index",
        ],  # keep query_index for backward compatibility
        tool_name: Optional[str] = None,
    ):
        if tool_name is not None:
            logger.warning(
                f"Tool name has been deprecated. Please use tool_suffixes instead. "
                f"Got tool_name: {tool_name}."
            )
        self.tool_name = tool_name
        self.tool_suffixes = tool_suffixes

    def is_query_engine_tool(self, tool_name: str) -> bool:
        if self.tool_name is not None:
            return tool_name == self.tool_name
        return any(tool_name.endswith(suffix) for suffix in self.tool_suffixes)

    def transform_tool_call_result(
        self, event: ToolCallResult
    ) -> Optional[SourceNodesEvent]:
        # Check whether result is error
        tool_output = event.tool_output
        if tool_output.is_error:
            return None
        else:
            raw_output = tool_output.raw_output
            if hasattr(raw_output, "source_nodes"):
                return SourceNodesEvent(nodes=raw_output.source_nodes)
            else:
                return None

    async def run(self, event: Any) -> Any:
        if isinstance(event, ToolCallResult):
            if self.is_query_engine_tool(event.tool_name):
                return event, self.transform_tool_call_result(event)
        return event

    @classmethod
    def from_default(cls, *args: Any, **kwargs: Any) -> "SourceNodesFromToolCall":
        return cls()
