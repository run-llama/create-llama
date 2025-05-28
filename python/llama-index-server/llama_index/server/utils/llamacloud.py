import os
import re
from typing import Any, Dict, Optional


def get_local_file_name(
    # Metadata
    node_metadata: Optional[Dict[str, Any]] = None,
    # Or construct from filename and pipeline_id
    llamacloud_file_name: Optional[str] = None,
    pipeline_id: Optional[str] = None,
) -> str:
    """
    Construct the local file name from the llamacloud_file_name and pipeline_id.
    Provide either node_metadata or llamacloud_file_name and pipeline_id.
    """
    # If node_metadata is provided, use it to construct the local file name
    if node_metadata is not None:
        llamacloud_file_name = node_metadata.get("file_name")
        pipeline_id = node_metadata.get("pipeline_id")
    # If llamacloud_file_name and pipeline_id are provided, use them to construct the local file name
    if llamacloud_file_name is None or pipeline_id is None:
        raise ValueError("Couldn't find llamacloud_file_name and pipeline_id")
    # Construct the local file name
    file_ext = os.path.splitext(llamacloud_file_name)[1]
    file_name = llamacloud_file_name.replace(file_ext, "")
    sanitized_file_name = re.sub(r"[^A-Za-z0-9_\-]", "_", file_name)
    return f"{sanitized_file_name}_{pipeline_id}{file_ext}"


def is_llamacloud_file(node_metadata: Dict[str, Any]) -> bool:
    return node_metadata.get("pipeline_id") is not None
