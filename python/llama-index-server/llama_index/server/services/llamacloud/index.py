import logging
import os
from typing import TYPE_CHECKING, Any, Optional

from llama_cloud import PipelineType
from pydantic import BaseModel, Field, field_validator

from llama_index.core.callbacks import CallbackManager
from llama_index.core.ingestion.api_utils import (
    get_client as llama_cloud_get_client,
)
from llama_index.core.settings import Settings
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex
from llama_index.server.models.chat import ChatRequest

if TYPE_CHECKING:
    from llama_cloud.client import LlamaCloud

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

    def __init__(self, **kwargs: Any) -> None:
        if "api_key" not in kwargs:
            kwargs["api_key"] = os.getenv("LLAMA_CLOUD_API_KEY")
        if "base_url" not in kwargs:
            kwargs["base_url"] = os.getenv("LLAMA_CLOUD_BASE_URL")
        if "organization_id" not in kwargs:
            kwargs["organization_id"] = os.getenv("LLAMA_CLOUD_ORGANIZATION_ID")
        if "pipeline" not in kwargs:
            kwargs["pipeline"] = os.getenv("LLAMA_CLOUD_INDEX_NAME")
        if "project" not in kwargs:
            kwargs["project"] = os.getenv("LLAMA_CLOUD_PROJECT_NAME")
        super().__init__(**kwargs)

    # Validate and throw error if the env variables are not set before starting the app
    @field_validator("pipeline", "project", "api_key", mode="before")
    @classmethod
    def validate_fields(cls, value: Any) -> Any:
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


class IndexConfig(BaseModel):
    llama_cloud_pipeline_config: LlamaCloudConfig = Field(
        default_factory=lambda: LlamaCloudConfig(),
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

    @classmethod
    def from_default(cls, chat_request: Optional[ChatRequest] = None) -> "IndexConfig":
        default_config = cls()
        if chat_request is not None and chat_request.data is not None:
            llamacloud_config = chat_request.data.llama_cloud_pipeline
            if llamacloud_config is not None:
                default_config.llama_cloud_pipeline_config.pipeline = (
                    llamacloud_config.pipeline
                )
                default_config.llama_cloud_pipeline_config.project = (
                    llamacloud_config.project
                )
        return default_config


def get_index(
    chat_request: Optional[ChatRequest] = None,
    create_if_missing: bool = False,
) -> Optional[LlamaCloudIndex]:
    config = IndexConfig.from_default(chat_request)
    # Check whether the index exists
    try:
        index = LlamaCloudIndex(**config.to_index_kwargs())
        return index
    except ValueError:
        logger.warning("Index not found")
        if create_if_missing:
            logger.info("Creating index")
            _create_index(config)
            return LlamaCloudIndex(**config.to_index_kwargs())
        return None


def get_client() -> "LlamaCloud":
    config = LlamaCloudConfig()
    return llama_cloud_get_client(**config.to_client_kwargs())


def _create_index(
    config: IndexConfig,
) -> None:
    client = get_client()
    pipeline_name = config.llama_cloud_pipeline_config.pipeline

    pipelines = client.pipelines.search_pipelines(
        pipeline_name=pipeline_name,
        pipeline_type=PipelineType.MANAGED.value,
    )
    if len(pipelines) == 0:
        from llama_index.embeddings.openai import OpenAIEmbedding

        if not isinstance(Settings.embed_model, OpenAIEmbedding):
            raise ValueError(
                "Creating a new pipeline with a non-OpenAI embedding model is not supported."
            )
        client.pipelines.upsert_pipeline(
            request={
                "name": pipeline_name,
                "embedding_config": {
                    "type": "OPENAI_EMBEDDING",
                    "component": {
                        "api_key": os.getenv("OPENAI_API_KEY"),  # editable
                        "model_name": Settings.embed_model.model_name
                        or "text-embedding-3-small",
                    },
                },
                "transform_config": {
                    "mode": "auto",
                    "config": {
                        "chunk_size": Settings.chunk_size,  # editable
                        "chunk_overlap": Settings.chunk_overlap,  # editable
                    },
                },
            },
        )
