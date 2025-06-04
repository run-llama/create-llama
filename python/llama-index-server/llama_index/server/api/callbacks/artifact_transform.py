import logging
from typing import Any

from llama_index.core.agent.workflow.workflow_events import AgentStream
from llama_index.server.api.callbacks.base import EventCallback
from llama_index.server.models.artifacts import ArtifactEvent
from llama_index.server.utils.inline import to_inline_annotation

logger = logging.getLogger("uvicorn")


class ArtifactTransform(EventCallback):
    """
    Transforms ArtifactEvent to AgentStream with inline annotation format.
    """

    async def run(self, event: Any) -> Any:
        if isinstance(event, ArtifactEvent):
            # Create the artifact annotation
            artifact_annotation = {
                "type": "artifact",
                "data": event.data.model_dump(),
            }

            # Transform to AgentStream with inline annotation format
            return AgentStream(
                delta=to_inline_annotation(artifact_annotation),
                response="",
                current_agent_name="assistant",
                tool_calls=[],
                raw=artifact_annotation,
            )
        return event

    @classmethod
    def from_default(cls, *args: Any, **kwargs: Any) -> "ArtifactTransform":
        return cls()
