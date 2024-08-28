import logging
import os
from typing import Dict, Optional

from llama_index.core.callbacks import CallbackManager
from llama_index.core.ingestion.api_utils import (
    get_client as llama_cloud_get_client,
)
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex
from pydantic import BaseModel, Field

logger = logging.getLogger("uvicorn")


class IndexConfig(BaseModel):
    llama_cloud_pipeline_config: Optional[Dict] = Field(
        default=None,
        alias="llamaCloudPipeline",
    )
    callback_manager: Optional[CallbackManager] = Field(
        default=None,
    )


def get_index(config: IndexConfig = None):
    if config is None:
        config = IndexConfig()
    name = config.llama_cloud_pipeline_config.get(
        "pipeline", os.getenv("LLAMA_CLOUD_INDEX_NAME")
    )
    project_name = config.llama_cloud_pipeline_config.get(
        "project", os.getenv("LLAMA_CLOUD_PROJECT_NAME")
    )
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
        callback_manager=config.callback_manager,
    )

    return index


def get_client():
    return llama_cloud_get_client(
        os.getenv("LLAMA_CLOUD_API_KEY"),
        os.getenv("LLAMA_CLOUD_BASE_URL"),
    )
