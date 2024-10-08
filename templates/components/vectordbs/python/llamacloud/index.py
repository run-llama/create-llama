import logging
import os
from typing import Optional

from llama_index.core.callbacks import CallbackManager
from llama_index.core.ingestion.api_utils import (
    get_client as llama_cloud_get_client,
)
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger("uvicorn")


class LlamaCloudConfig(BaseModel):
    # Private attributes
    api_key: str = Field(
        exclude=True,  # Exclude from the model representation
    )
    base_url: Optional[str] = Field(
        exclude=True,
    )
    organization_id: Optional[str] = Field(
        exclude=True,
    )
    # Configuration attributes, can be set by the user
    pipeline: str = Field(
        description="The name of the pipeline to use",
    )
    project: str = Field(
        description="The name of the LlamaCloud project",
    )

    # Validate and throw error if the env variables are not set before starting the app
    @field_validator("pipeline", "project", "api_key", mode="before")
    @classmethod
    def validate_fields(cls, value):
        if value is None:
            raise ValueError(
                "Please set LLAMA_CLOUD_INDEX_NAME, LLAMA_CLOUD_PROJECT_NAME and LLAMA_CLOUD_API_KEY"
                " to your environment variables or config them in .env file"
            )
        return value

    def to_client_kwargs(self) -> dict:
        return {
            "api_key": self.api_key,
            "base_url": self.base_url,
        }

    @classmethod
    def from_env(cls):
        return LlamaCloudConfig(
            api_key=os.getenv("LLAMA_CLOUD_API_KEY"),
            base_url=os.getenv("LLAMA_CLOUD_BASE_URL"),
            organization_id=os.getenv("LLAMA_CLOUD_ORGANIZATION_ID"),
            pipeline=os.getenv("LLAMA_CLOUD_INDEX_NAME"),
            project=os.getenv("LLAMA_CLOUD_PROJECT_NAME"),
        )


class IndexConfig(BaseModel):
    llama_cloud_pipeline_config: LlamaCloudConfig = Field(
        default_factory=LlamaCloudConfig.from_env,
        alias="llamaCloudPipeline",
    )
    callback_manager: Optional[CallbackManager] = Field(
        default=None,
    )

    def to_index_kwargs(self) -> dict:
        return {
            "name": self.llama_cloud_pipeline_config.pipeline,
            "project_name": self.llama_cloud_pipeline_config.project,
            "api_key": self.llama_cloud_pipeline_config.api_key,
            "base_url": self.llama_cloud_pipeline_config.base_url,
            "organization_id": self.llama_cloud_pipeline_config.organization_id,
            "callback_manager": self.callback_manager,
        }


def get_index(config: IndexConfig = None):
    if config is None:
        config = IndexConfig()
    index = LlamaCloudIndex(**config.to_index_kwargs())

    return index


def get_client():
    config = LlamaCloudConfig.from_env()
    return llama_cloud_get_client(**config.to_client_kwargs())
