import os
from typing import Any, Dict, Optional

from llama_index.server.settings import server_settings
from llama_index.server.utils import llamacloud


def get_file_url_from_metadata(
    metadata: Dict[str, Any],
    data_dir: Optional[str] = None,
) -> Optional[str]:
    """
    Get the URL of a file from the source node metadata.
    """
    url_prefix = server_settings.file_server_url_prefix
    if data_dir is None:
        data_dir = "data"
    file_name = metadata.get("file_name")

    if file_name and url_prefix:
        if llamacloud.is_llamacloud_file(metadata):
            file_name = llamacloud.get_local_file_name(metadata)
            return f"{url_prefix}/output/llamacloud/{file_name}"
        is_private = metadata.get("private", "false") == "true"
        if is_private:
            # file is a private upload
            return f"{url_prefix}/output/uploaded/{file_name}"
        # file is from calling the 'generate' script
        # Get the relative path of file_path to data_dir
        file_path = metadata.get("file_path")
        data_dir = os.path.abspath(data_dir)
        if file_path and data_dir:
            relative_path = os.path.relpath(file_path, data_dir)
            return f"{url_prefix}/data/{relative_path}"
    # fallback to URL in metadata (e.g. for websites)
    return metadata.get("URL")
