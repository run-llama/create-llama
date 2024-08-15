import logging
import os
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex
from llama_index.core.ingestion.api_utils import (
    get_client as llama_cloud_get_client,
)

logger = logging.getLogger("uvicorn")


def get_client():
    return llama_cloud_get_client(
        os.getenv("LLAMA_CLOUD_API_KEY"),
        os.getenv("LLAMA_CLOUD_BASE_URL"),
    )


def get_index(params=None):
    configParams = params or {}
    pipelineConfig = configParams.get("llamaCloudPipeline", {})
    name = pipelineConfig.get("pipeline", os.getenv("LLAMA_CLOUD_INDEX_NAME"))
    project_name = pipelineConfig.get("project", os.getenv("LLAMA_CLOUD_PROJECT_NAME"))
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
        organization_id=organization_id,
    )

    return index
