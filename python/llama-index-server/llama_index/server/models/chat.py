import re
from typing import Any, List, Optional

from pydantic import BaseModel, field_validator

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


class ChatRequest(BaseModel):
    id: str  # see https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat#id - constant for the same chat session
    messages: List[ChatAPIMessage]
    data: Optional[Any] = None

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
