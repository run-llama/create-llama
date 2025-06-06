import re
from typing import Any, List, Literal, Optional, Union

from pydantic import BaseModel, Field, field_validator

from llama_index.core.types import ChatMessage, MessageRole
from llama_index.server.models.file import ServerFileResponse


class FileData(BaseModel):
    """
    The data of a file.
    """

    files: List[ServerFileResponse]


class FileAnnotation(BaseModel):
    """
    The annotation of a file.
    """

    type: Literal["document_file"]
    data: FileData


class FileUpload(BaseModel):
    """
    The file to be uploaded to the chat.
    """

    name: str
    base64: str
    params: Any = None


class LlamaCloudPipeline(BaseModel):
    """
    The selected LlamaCloud pipeline to use for the chat.
    (Only available when the app is configured to use LlamaCloud)
    """

    pipeline: str
    project: str


class ChatData(BaseModel):
    """
    The data of a chat.
    """

    llama_cloud_pipeline: Optional[LlamaCloudPipeline] = Field(
        default=None,
        description="The selected LlamaCloud pipeline to use for the chat",
        alias="llamaCloudPipeline",
        serialization_alias="llamaCloudPipeline",
    )


class ChatAPIMessage(BaseModel):
    role: MessageRole
    content: str
    annotations: Optional[List[Union[FileAnnotation, Any]]] = None

    def to_llamaindex_message(self) -> ChatMessage:
        """
        Simply convert text content of API message to llama_index's ChatMessage.
        Annotations are not included.
        """
        return ChatMessage(role=self.role, content=self.content)

    @property
    def human_response(self) -> Optional[Any]:
        if self.annotations:
            for annotation in self.annotations:
                if (
                    isinstance(annotation, dict)
                    and annotation.get("type") == "human_response"
                ):
                    return annotation.get("data", {})
        return None


class ChatRequest(BaseModel):
    """
    The request to the chat API.
    """

    id: str  # see https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#id - constant for the same chat session
    messages: List[ChatAPIMessage]
    data: Optional[ChatData] = Field(
        default=None,
        description="The data of the chat",
    )

    @field_validator("messages")
    def validate_messages(cls, v: List[ChatAPIMessage]) -> List[ChatAPIMessage]:
        if v[-1].role != MessageRole.USER:
            raise ValueError("Last message must be from user")
        return v

    @field_validator("id")
    def validate_id(cls, v: str) -> str:
        if re.search(r"[^a-zA-Z0-9_-]", v):
            raise ValueError("ID contains special characters")
        return v
