from typing import Any, Dict, Optional

from llama_index.core.agent.workflow.workflow_events import ToolCallResult
from llama_index.server.api.callbacks.base import EventCallback
from llama_index.server.api.models import Artifact


class ArtifactFromToolCall(EventCallback):
    """
    Extract artifact from the query tool output.

    Args:
        query_tool_name: The name of the tool that queries the index.
                         default is "artifact"
    """

    def __init__(self, tool_prefix: str = "artifact_"):
        self.tool_prefix = tool_prefix

    def transform_tool_call_result(
        self, event: ToolCallResult
    ) -> Optional[Dict[str, Any]]:
        artifact: Artifact = event.tool_output.raw_output
        if isinstance(artifact, str):  # Error tool output
            return None
        return {
            "type": "artifact",
            "data": artifact.model_dump(),
        }

    async def run(self, event: Any) -> Any:
        if isinstance(event, ToolCallResult):
            if event.tool_name.startswith(self.tool_prefix):
                return event, self.transform_tool_call_result(event)
        return event

    @classmethod
    def from_default(cls, *args: Any, **kwargs: Any) -> "ArtifactFromToolCall":
        return cls()
