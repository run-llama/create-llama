import logging
from typing import Any, List

from fastapi import BackgroundTasks
from llama_index.core.schema import NodeWithScore
from llama_index.server.api.callbacks.base import EventCallback
from llama_index.server.services.llamacloud.file import LlamaCloudFileService

logger = logging.getLogger("uvicorn")


class LlamaCloudFileDownload(EventCallback):
    """
    Processor for handling LlamaCloud file downloads from source nodes.
    """

    def __init__(self, background_tasks: BackgroundTasks) -> None:
        self.background_tasks = background_tasks

    async def run(self, event: Any) -> Any:
        if hasattr(event, "to_response"):
            event_response = event.to_response()
            if event_response.get("type") == "sources" and hasattr(event, "nodes"):
                await self._process_response_nodes(event.nodes)
        return event

    async def _process_response_nodes(self, source_nodes: List[NodeWithScore]) -> None:
        try:
            LlamaCloudFileService.download_files_from_nodes(
                source_nodes, self.background_tasks
            )
        except ImportError:
            pass

    @classmethod
    def from_default(
        cls, background_tasks: BackgroundTasks
    ) -> "LlamaCloudFileDownload":
        return cls(background_tasks=background_tasks)
