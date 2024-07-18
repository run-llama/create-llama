import logging
import os
from typing import Any, Dict, List, Literal, Optional, Set

from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.core.schema import NodeWithScore
from pydantic import BaseModel, Field, validator
from pydantic.alias_generators import to_camel

logger = logging.getLogger("uvicorn")


class FileContent(BaseModel):
    type: Literal["text", "ref"]
    # If the file is pure text then the value is be a string
    # otherwise, it's a list of document IDs
    value: str | List[str]


class File(BaseModel):
    id: str
    content: FileContent
    filename: str
    filesize: int
    filetype: str


class AnnotationData(BaseModel):
    files: List[File] = Field(
        default=[],
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

    def to_content(self) -> str | None:
        if self.type == "document_file":
            # We only support generating context content for CSV files for now
            csv_files = [file for file in self.data.files if file.filetype == "csv"]
            if len(csv_files) > 0:
                return "Use data from following CSV raw content\n" + "\n".join(
                    [f"```csv\n{csv_file.content.value}\n```" for csv_file in csv_files]
                )
        else:
            logger.warning(
                f"The annotation {self.type} is not supported for generating context content"
            )
        return None


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
        Get the content of the last message along with the data content if available.
        Fallback to use data content from previous messages
        """
        if len(self.messages) == 0:
            raise ValueError("There is not any message in the chat")
        last_message = self.messages[-1]
        message_content = last_message.content
        for message in reversed(self.messages):
            if message.role == MessageRole.USER and message.annotations is not None:
                annotation_contents = filter(
                    None,
                    [annotation.to_content() for annotation in message.annotations],
                )
                if not annotation_contents:
                    continue
                annotation_text = "\n".join(annotation_contents)
                message_content = f"{message_content}\n{annotation_text}"
                break
        return message_content

    def get_history_messages(self) -> List[ChatMessage]:
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
        """
        Get the document IDs from the chat messages
        """
        document_ids: List[str] = []
        for message in self.messages:
            if message.role == MessageRole.USER and message.annotations is not None:
                for annotation in message.annotations:
                    if (
                        annotation.type == "document_file"
                        and annotation.data.files is not None
                    ):
                        for fi in annotation.data.files:
                            if fi.content.type == "ref":
                                document_ids += fi.content.value
        return list(set(document_ids))


class LlamaCloudFile(BaseModel):
    file_name: str
    pipeline_id: str

    def __eq__(self, other):
        if not isinstance(other, LlamaCloudFile):
            return NotImplemented
        return (
            self.file_name == other.file_name and self.pipeline_id == other.pipeline_id
        )

    def __hash__(self):
        return hash((self.file_name, self.pipeline_id))


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
        pipeline_id = metadata.get("pipeline_id")
        file_name = metadata.get("file_name")
        is_private = metadata.get("private", "false") == "true"
        is_local_file = metadata.get("is_local_file")
        url_prefix = os.getenv("FILESERVER_URL_PREFIX")
        if not url_prefix:
            logger.warning(
                "Warning: FILESERVER_URL_PREFIX not set in environment variables"
            )
        if file_name and url_prefix:
            if not is_local_file:
                if pipeline_id is None:
                    logger.warning(
                        "Warning: The file source is llamacloud but pipeline_id is not set. Cannot construct file url"
                    )
                else:
                    file_name = f"{pipeline_id}${file_name}"
                    url = f"{url_prefix}/output/llamacloud/{file_name}"
            elif is_private:
                url = f"{url_prefix}/output/uploaded/{file_name}"
            else:
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

    @staticmethod
    def get_download_files(nodes: List[NodeWithScore]) -> Set[LlamaCloudFile]:
        source_nodes = SourceNodes.from_source_nodes(nodes)
        llama_cloud_files = [
            LlamaCloudFile(
                file_name=node.metadata.get("file_name"),
                pipeline_id=node.metadata.get("pipeline_id"),
            )
            for node in source_nodes
            if (
                not node.metadata.get(
                    "is_local_file"
                )  # Download the file of the node flagged as not local
                and node.metadata.get("pipeline_id") is not None
                and node.metadata.get("file_name") is not None
            )
        ]
        # Remove duplicates and return
        return set(llama_cloud_files)


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
