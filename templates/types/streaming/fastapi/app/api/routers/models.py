import os
import logging
from pydantic import BaseModel, Field, validator
from pydantic.alias_generators import to_camel
from typing import List, Any, Optional, Dict
from llama_index.core.schema import NodeWithScore
from llama_index.core.llms import ChatMessage, MessageRole


logger = logging.getLogger("uvicorn")


class File(BaseModel):
    id: str
    content: str | List[str]
    filename: str
    filesize: int
    filetype: str


class AnnotationData(BaseModel):
    files: List[File] | None = Field(
        default=None,
        description="List of files",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "csvFiles": [
                    {
                        "content": "Name, Age\nAlice, 25\nBob, 30",
                        "filename": "example.csv",
                        "filesize": 123,
                        "id": "123",
                        "type": "text/csv",
                    }
                ]
            }
        }
        alias_generator = to_camel


class Annotation(BaseModel):
    type: str
    data: AnnotationData

    def to_content(self) -> str:
        if self.type == "csv":
            csv_files = self.data.csv_files
            if csv_files is not None and len(csv_files) > 0:
                return "Use data from following CSV raw contents\n" + "\n".join(
                    [f"```csv\n{csv_file.content}\n```" for csv_file in csv_files]
                )
        raise ValueError(f"Unsupported annotation type: {self.type}")


class Message(BaseModel):
    role: MessageRole
    content: str
    annotations: List[Annotation] | None = None


class ChatData(BaseModel):
    messages: List[Message]

    class Config:
        json_schema_extra = {
            "example": {
                "messages": [
                    {
                        "role": "user",
                        "content": "What standards for letters exist?",
                    }
                ]
            }
        }

    @validator("messages")
    def messages_must_not_be_empty(cls, v):
        if len(v) == 0:
            raise ValueError("Messages must not be empty")
        return v

    def get_last_message_content(self) -> str:
        """
        Get the content of the last message along with the data content if available. Fallback to use data content from previous messages
        """
        if len(self.messages) == 0:
            raise ValueError("There is not any message in the chat")
        last_message = self.messages[-1]
        message_content = last_message.content
        return message_content

    def get_history_messages(self) -> List[Message]:
        """
        Get the history messages
        """
        return [
            ChatMessage(role=message.role, content=message.content)
            for message in self.messages[:-1]
        ]

    def is_last_message_from_user(self) -> bool:
        return self.messages[-1].role == MessageRole.USER

    def get_chat_document_ids(self) -> List[str]:
        # Get annotations from the last message has annotations
        ids = []
        for message in reversed(self.messages):
            if message.role == MessageRole.USER and message.annotations is not None:
                for annotation in message.annotations:
                    if annotation.type == "document_file":
                        for fi in annotation.data.files:
                            ids += fi.content
        return list(set(ids))


class SourceNodes(BaseModel):
    id: str
    metadata: Dict[str, Any]
    score: Optional[float]
    text: str
    url: Optional[str]

    @classmethod
    def from_source_node(cls, source_node: NodeWithScore):
        metadata = source_node.node.metadata
        url = metadata.get("URL")

        if not url:
            file_name = metadata.get("file_name")
            url_prefix = os.getenv("FILESERVER_URL_PREFIX")
            if not url_prefix:
                logger.warning(
                    "Warning: FILESERVER_URL_PREFIX not set in environment variables"
                )
            if file_name and url_prefix:
                url = f"{url_prefix}/data/{file_name}"

        return cls(
            id=source_node.node.node_id,
            metadata=metadata,
            score=source_node.score,
            text=source_node.node.text,  # type: ignore
            url=url,
        )

    @classmethod
    def from_source_nodes(cls, source_nodes: List[NodeWithScore]):
        return [cls.from_source_node(node) for node in source_nodes]


class Result(BaseModel):
    result: Message
    nodes: List[SourceNodes]


class ChatConfig(BaseModel):
    starter_questions: Optional[List[str]] = Field(
        default=None,
        description="List of starter questions",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "starterQuestions": [
                    "What standards for letters exist?",
                    "What are the requirements for a letter to be considered a letter?",
                ]
            }
        }
        alias_generator = to_camel
