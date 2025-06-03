import re
from enum import Enum
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator

from llama_index.core.types import ChatMessage, MessageRole


class ChatAPIMessage(BaseModel):
    role: MessageRole
    content: str
    annotations: Optional[List[Any]] = None

    def to_llamaindex_message(self) -> ChatMessage:
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


class ChatFile(BaseModel):
    """
    The file to be uploaded to the chat.
    """

    chat_id: str
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


class AttachmentType(Enum):
    FILE = "file"


class ChatAttachment(BaseModel):
    """
    The attachment of a chat.
    """

    type: AttachmentType = Field(
        default=AttachmentType.FILE,
        description="The type of attachment",
    )
    data: Any = Field(
        default=None,
        description="The data of the attachment",
    )


class ChatData(BaseModel):
    """
    The data of a chat.
    """

    # It doesn't sound good to call llama_cloud_pipeline a chat data.
    # just to keep API contract for now.
    llama_cloud_pipeline: Optional[LlamaCloudPipeline] = Field(
        default=None,
        description="The selected LlamaCloud pipeline to use for the chat",
        alias="llamaCloudPipeline",
        serialization_alias="llamaCloudPipeline",
    )
    attachments: List[ChatAttachment] = Field(
        default_factory=list,
        description="The attachments to the chat. This is used to index the files in the chat.",
    )


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
