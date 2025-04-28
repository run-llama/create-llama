import logging
import os
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator

from llama_index.core.schema import NodeWithScore
from llama_index.core.types import ChatMessage, MessageRole
from llama_index.core.workflow import Event
from llama_index.server.settings import server_settings

logger = logging.getLogger("uvicorn")


class ChatConfig(BaseModel):
    next_question_suggestions: bool = Field(
        default=True,
        description="Whether to suggest next questions",
    )


class ChatAPIMessage(BaseModel):
    role: MessageRole
    content: str
    annotations: Optional[List[Any]] = None

    def to_llamaindex_message(self) -> ChatMessage:
        return ChatMessage(role=self.role, content=self.content)


class ChatRequest(BaseModel):
    messages: List[ChatAPIMessage]
    data: Optional[Any] = None
    config: Optional[ChatConfig] = ChatConfig()

    @field_validator("messages")
    def validate_messages(cls, v: List[ChatAPIMessage]) -> List[ChatAPIMessage]:
        if v[-1].role != MessageRole.USER:
            raise ValueError("Last message must be from user")
        return v


class AgentRunEventType(Enum):
    TEXT = "text"
    PROGRESS = "progress"


class AgentRunEvent(Event):
    name: str
    msg: str
    event_type: AgentRunEventType = AgentRunEventType.TEXT
    data: Optional[dict] = None

    def to_response(self) -> dict:
        return {
            "type": "agent",
            "data": {
                "agent": self.name,
                "type": self.event_type.value,
                "text": self.msg,
                "data": self.data,
            },
        }


class SourceNodesEvent(Event):
    nodes: List[NodeWithScore]

    def to_response(self) -> dict:
        return {
            "type": "sources",
            "data": {
                "nodes": [
                    SourceNodes.from_source_node(node).model_dump()
                    for node in self.nodes
                ]
            },
        }


class SourceNodes(BaseModel):
    id: str
    metadata: Dict[str, Any]
    score: Optional[float]
    text: str
    url: Optional[str]

    @classmethod
    def from_source_node(cls, source_node: NodeWithScore) -> "SourceNodes":
        metadata = source_node.node.metadata
        url = cls.get_url_from_metadata(metadata)

        return cls(
            id=source_node.node.node_id,
            metadata=metadata,
            score=source_node.score,
            text=source_node.node.text,  # type: ignore
            url=url,
        )

    @classmethod
    def get_url_from_metadata(
        cls,
        metadata: Dict[str, Any],
        data_dir: Optional[str] = None,
    ) -> Optional[str]:
        url_prefix = server_settings.file_server_url_prefix
        if data_dir is None:
            data_dir = "data"
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
            data_dir = os.path.abspath(data_dir)
            if file_path and data_dir:
                relative_path = os.path.relpath(file_path, data_dir)
                return f"{url_prefix}/data/{relative_path}"
        # fallback to URL in metadata (e.g. for websites)
        return metadata.get("URL")

    @classmethod
    def from_source_nodes(
        cls, source_nodes: List[NodeWithScore]
    ) -> List["SourceNodes"]:
        return [cls.from_source_node(node) for node in source_nodes]


class ComponentDefinition(BaseModel):
    type: str
    code: str
    filename: str


class UIEvent(Event):
    type: str
    data: BaseModel

    def to_response(self) -> dict:
        return {
            "type": self.type,
            "data": self.data.model_dump(),
        }


class ArtifactType(str, Enum):
    CODE = "code"
    DOCUMENT = "document"


class CodeArtifactData(BaseModel):
    file_name: str
    code: str
    language: str


class DocumentArtifactData(BaseModel):
    title: str
    content: str
    type: Literal["markdown", "html"]


class Artifact(BaseModel):
    created_at: Optional[int] = None
    type: ArtifactType
    data: Union[CodeArtifactData, DocumentArtifactData]

    @classmethod
    def from_message(cls, message: ChatAPIMessage) -> Optional["Artifact"]:
        if not message.annotations or not isinstance(message.annotations, list):
            return None

        for annotation in message.annotations:
            if isinstance(annotation, dict) and annotation.get("type") == "artifact":
                try:
                    artifact = cls.model_validate(annotation.get("data"))
                    return artifact
                except Exception as e:
                    logger.warning(
                        f"Failed to parse artifact from annotation: {annotation}. Error: {e}"
                    )

        return None


class ArtifactEvent(Event):
    type: str = "artifact"
    data: Artifact

    def to_response(self) -> dict:
        return {
            "type": self.type,
            "data": self.data.model_dump(),
        }
