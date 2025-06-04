import logging
from typing import Any

from llama_index.server.api.callbacks.base import EventCallback
from llama_index.server.models.artifacts import ArtifactEvent
from llama_index.server.utils.inline import to_inline_annotation_event

logger = logging.getLogger("uvicorn")


class InlineAnnotationTransformer(EventCallback):
    """
    Transforms an event to AgentStream with inline annotation format.
    """

    async def run(self, event: Any) -> Any:
        # handle for ArtifactEvent specifically as it's only supported by inline annotation
        if isinstance(event, ArtifactEvent):
            return to_inline_annotation_event(event)
        return event

    @classmethod
    def from_default(cls, *args: Any, **kwargs: Any) -> "InlineAnnotationTransformer":
        return cls()
