import logging
from typing import Any, List

from fastapi import BackgroundTasks
from llama_index.core.schema import NodeWithScore

from app.api.callbacks.base import EventCallback

logger = logging.getLogger("uvicorn")


class LlamaCloudFileDownload(EventCallback):
    """
    Processor for handling LlamaCloud file downloads from source nodes.
    Only work if LlamaCloud service code is available.
    """

    def __init__(self, background_tasks: BackgroundTasks):
        self.background_tasks = background_tasks

    async def run(self, event: Any) -> Any:
        if hasattr(event, "to_response"):
            event_response = event.to_response()
            if event_response.get("type") == "sources" and hasattr(event, "nodes"):
                await self._process_response_nodes(event.nodes)
        return event

    async def _process_response_nodes(self, source_nodes: List[NodeWithScore]):
        try:
            from app.engine.service import LLamaCloudFileService  # type: ignore

            LLamaCloudFileService.download_files_from_nodes(
                source_nodes, self.background_tasks
            )
        except ImportError:
            pass

    @classmethod
    def from_default(
        cls, background_tasks: BackgroundTasks
    ) -> "LlamaCloudFileDownload":
        return cls(background_tasks=background_tasks)
