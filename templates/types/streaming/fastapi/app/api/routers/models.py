import os
import logging
import tempfile
from pydantic import BaseModel, Field, validator
from pydantic.alias_generators import to_camel
from typing import List, Any, Optional, Dict
from llama_index.core.schema import NodeWithScore
from llama_index.core.llms import ChatMessage, MessageRole


logger = logging.getLogger("uvicorn")


class Message(BaseModel):
    role: MessageRole
    content: str


class CsvFile(BaseModel):
    content: str
    filename: str
    filesize: int
    id: str
    type: str
    local_file_path: Optional[str] = None

    def __init__(self, **data):
        super().__init__(**data)

        # Write the content to a temporary file
        saved_path = self.write_to_temp_file(self.content)
        self.local_file_path = saved_path

    @staticmethod
    def write_to_temp_file(file_content: str) -> str:
        """
        Write the content to a temporary file and return the file path
        """
        csv_file = tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".csv")
        csv_file.write(file_content)
        file_path = csv_file.name
        return file_path

    def __del__(self):
        # Remove the temporary file once the object is deleted
        if self.local_file_path:
            os.remove(self.local_file_path)


class DataParserOptions(BaseModel):
    csv_files: List[CsvFile] | None = Field(
        default=None,
        description="List of CSV files",
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

    def to_raw_content(self) -> str:
        if self.csv_files is not None and len(self.csv_files) > 0:
            saved_path = self.csv_files[0].local_file_path
            saved_file_name = os.path.basename(saved_path)
            content = self.csv_files[0].content
            csv_meta = {
                "local_file_path": saved_path,
                "example_data": content[: min(200, len(content))],
                "sandbox_file_path": f"/home/user/{saved_file_name}",
            }

            return f"Provided CSV file metadata:\n{csv_meta}"

    def to_response_data(self) -> list[dict] | None:
        output = []
        if self.csv_files is not None and len(self.csv_files) > 0:
            output.append(
                {
                    "type": "csv",
                    "data": {
                        "csvFiles": [csv_file.dict() for csv_file in self.csv_files]
                    },
                }
            )
        return output if len(output) > 0 else None


class ChatData(BaseModel):
    data: DataParserOptions | None = Field(
        default=None,
    )
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
        Get the content of the last message along with the data content if available
        """
        message_content = self.messages[-1].content
        if self.data:
            message_content += "\n" + self.data.to_raw_content()
        return message_content

    def get_history_messages(self) -> List[Message]:
        """
        Get the history messages
        """
        return [
            ChatMessage(role=message.role, content=message.content)
            for message in self.messages[:-1]
        ]

    def get_additional_data_response(self) -> list[dict] | None:
        """
        Get the additional data
        """
        return self.data.to_response_data()

    def is_last_message_from_user(self) -> bool:
        return self.messages[-1].role == MessageRole.USER


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
