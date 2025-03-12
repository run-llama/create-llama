import logging
import os
from typing import Any, Dict, Optional

from app.api.callbacks.base import EventCallback
from app.config import DATA_DIR
from llama_index.core.agent.workflow.workflow_events import ToolCallResult

logger = logging.getLogger("uvicorn")


class AddNodeUrl(EventCallback):
    """
    Add URL to source nodes
    """

    async def run(self, event: Any) -> Any:
        if self._is_retrieval_result_event(event):
            for node_score in event.tool_output.raw_output.source_nodes:
                node_score.node.metadata["url"] = self._get_url_from_metadata(
                    node_score.node.metadata
                )
        return event

    def _is_retrieval_result_event(self, event: Any) -> bool:
        if isinstance(event, ToolCallResult):
            if event.tool_name == "query_engine":
                return True
        return False

    def _get_url_from_metadata(self, metadata: Dict[str, Any]) -> Optional[str]:
        url_prefix = os.getenv("FILESERVER_URL_PREFIX")
        if not url_prefix:
            logger.warning(
                "Warning: FILESERVER_URL_PREFIX not set in environment variables. Can't use file server"
            )
        file_name = metadata.get("file_name")

        if file_name and url_prefix:
            # file_name exists and file server is configured
            pipeline_id = metadata.get("pipeline_id")
            if pipeline_id:
                # file is from LlamaCloud
                file_name = f"{pipeline_id}${file_name}"
                return f"{url_prefix}/output/llamacloud/{file_name}"
            is_private = metadata.get("private", "false") == "true"
            if is_private:
                # file is a private upload
                return f"{url_prefix}/output/uploaded/{file_name}"
            # file is from calling the 'generate' script
            # Get the relative path of file_path to data_dir
            file_path = metadata.get("file_path")
            data_dir = os.path.abspath(DATA_DIR)
            if file_path and data_dir:
                relative_path = os.path.relpath(file_path, data_dir)
                return f"{url_prefix}/data/{relative_path}"
        # fallback to URL in metadata (e.g. for websites)
        return metadata.get("URL")

    @classmethod
    def from_default(cls) -> "AddNodeUrl":
        return cls()
