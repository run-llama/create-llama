import time
from typing import Any

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

    def __init__(self, tool_name: str = "artifact_generator"):
        self.tool_name = tool_name

    def transform_tool_call_result(self, event: ToolCallResult) -> Artifact:
        artifact = event.tool_output.raw_output
        return Artifact(
            created_at=int(time.time()),
            type=artifact.get("type"),
            data=artifact.get("data"),
        )

    async def run(self, event: Any) -> Any:
        if isinstance(event, ToolCallResult):
            if event.tool_name == self.tool_name:
                return event, self.transform_tool_call_result(event)
        return event

    @classmethod
    def from_default(cls, *args: Any, **kwargs: Any) -> "ArtifactFromToolCall":
        return cls()
