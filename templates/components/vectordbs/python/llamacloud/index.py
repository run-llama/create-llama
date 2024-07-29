import logging
import os
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex


logger = logging.getLogger("uvicorn")


def get_index():
    name = os.getenv("LLAMA_CLOUD_INDEX_NAME")
    project_name = os.getenv("LLAMA_CLOUD_PROJECT_NAME")
    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    base_url = os.getenv("LLAMA_CLOUD_BASE_URL")
    organization_id = os.getenv("LLAMA_CLOUD_ORGANIZATION_ID")

    if name is None or project_name is None or api_key is None:
        raise ValueError(
            "Please set LLAMA_CLOUD_INDEX_NAME, LLAMA_CLOUD_PROJECT_NAME and LLAMA_CLOUD_API_KEY"
            " to your environment variables or config them in .env file"
        )

    index = LlamaCloudIndex(
        name=name,
        project_name=project_name,
        api_key=api_key,
        base_url=base_url,
        organization_id=organization_id
    )

    return index
