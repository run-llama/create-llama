import logging
from typing import Any, List, Optional

from llama_index.core.agent.workflow.workflow_events import ToolCallResult
from llama_index.core.schema import NodeWithScore
from llama_index.server.api.callbacks.base import EventCallback
from llama_index.server.models.source_nodes import SourceNodesEvent

logger = logging.getLogger(__name__)


class SourceNodesFromToolCall(EventCallback):
    """
    Extract source nodes from the query tool output.
    """

    def __init__(self, tool_name: Optional[str] = None):
        # backward compatibility
        if tool_name is not None:
            logger.warning(
                "tool_name has been deprecated. It's now detected by the tool output."
            )

    def _get_source_nodes(self, event: ToolCallResult) -> Optional[List[NodeWithScore]]:
        # If result is not error
        if event.tool_output.is_error:
            return None
        # If result is not error, check if source nodes are in the tool output
        raw_output = event.tool_output.raw_output
        if hasattr(raw_output, "source_nodes"):
            source_nodes = raw_output.source_nodes
            # Verify if source_nodes is List[NodeWithScore]
            if isinstance(source_nodes, list) and all(
                isinstance(node, NodeWithScore) for node in source_nodes
            ):
                return source_nodes
            else:
                return None
        else:
            return None

    async def run(self, event: Any) -> Any:
        events = [event]
        if isinstance(event, ToolCallResult):
            source_nodes = self._get_source_nodes(event)
            if source_nodes is not None:
                events.append(SourceNodesEvent(nodes=source_nodes))
        return events

    @classmethod
    def from_default(cls, *args: Any, **kwargs: Any) -> "SourceNodesFromToolCall":
        return cls()
