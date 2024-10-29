import logging
import os
from typing import Any, Dict, List, Optional

from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.core.schema import NodeWithScore
from pydantic import BaseModel, Field, validator
from pydantic.alias_generators import to_camel

from app.config import DATA_DIR
from app.services.file import DocumentFile

logger = logging.getLogger("uvicorn")


class AnnotationFileData(BaseModel):
    files: List[DocumentFile] = Field(
        default=[],
        description="List of files",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "files": [
                    {
                        "content": "data:text/plain;base64,aGVsbG8gd29ybGQK=",
                        "name": "example.txt",
                    }
                ]
            }
        }
        alias_generator = to_camel

    @staticmethod
    def _get_url_llm_content(file: DocumentFile) -> Optional[str]:
        url_prefix = os.getenv("FILESERVER_URL_PREFIX")
        if url_prefix:
            if file.url is not None:
                return f"File URL: {file.url}\n"
            else:
                # Construct url from file name
                return f"File URL (instruction: do not update this file URL yourself): {url_prefix}/output/uploaded/{file.name}\n"
        else:
            logger.warning(
                "Warning: FILESERVER_URL_PREFIX not set in environment variables. Can't use file server"
            )
            return None

    @classmethod
    def _get_file_content(cls, file: DocumentFile) -> str:
        """
        Construct content for LLM from the file metadata
        """
        default_content = f"=====File: {file.name}=====\n"
        # Include file URL if it's available
        url_content = cls._get_url_llm_content(file)
        if url_content:
            default_content += url_content
        # Include document IDs if it's available
        if file.refs is not None:
            default_content += f"Document IDs: {file.refs}\n"
        # file path
        sandbox_file_path = f"/tmp/{file.name}"
        local_file_path = f"output/uploaded/{file.name}"
        default_content += f"Sandbox file path (instruction: only use sandbox path for artifact or code interpreter tool): {sandbox_file_path}\n"
        default_content += f"Local file path (instruction: Use for local tools: form filling, extractor): {local_file_path}\n"
        return default_content

    def to_llm_content(self) -> Optional[str]:
        file_contents = [self._get_file_content(file) for file in self.files]
        if len(file_contents) == 0:
            return None
        return "Use data from following files content\n" + "\n".join(file_contents)


class AgentAnnotation(BaseModel):
    agent: str
    text: str


class ArtifactAnnotation(BaseModel):
    toolCall: Dict[str, Any]
    toolOutput: Dict[str, Any]


class Annotation(BaseModel):
    type: str
    data: AnnotationFileData | List[str] | AgentAnnotation | ArtifactAnnotation

    def to_content(self) -> Optional[str]:
        if self.type == "document_file" and isinstance(self.data, AnnotationFileData):
            return self.data.to_llm_content()
        elif self.type == "image":
            raise NotImplementedError("Use image file is not supported yet!")
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
    data: Any = None

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
        Get the content of the last message along with the data content from all user messages
        """
        if len(self.messages) == 0:
            raise ValueError("There is not any message in the chat")

        last_message = self.messages[-1]
        message_content = last_message.content

        # Collect annotation contents from all user messages
        all_annotation_contents: List[str] = []
        for message in self.messages:
            if message.role == MessageRole.USER and message.annotations is not None:
                annotation_contents = filter(
                    None,
                    [annotation.to_content() for annotation in message.annotations],
                )
                all_annotation_contents.extend(annotation_contents)

        # Add all annotation contents if any exist
        if len(all_annotation_contents) > 0:
            annotation_text = "\n".join(all_annotation_contents)
            message_content = f"{message_content}\n{annotation_text}"

        return message_content

    def _get_agent_messages(self, max_messages: int = 10) -> List[str]:
        """
        Construct agent messages from the annotations in the chat messages
        """
        agent_messages = []
        for message in self.messages:
            if (
                message.role == MessageRole.ASSISTANT
                and message.annotations is not None
            ):
                for annotation in message.annotations:
                    if annotation.type == "agent" and isinstance(
                        annotation.data, AgentAnnotation
                    ):
                        text = annotation.data.text
                        agent_messages.append(
                            f"\nAgent: {annotation.data.agent}\nsaid: {text}\n"
                        )
                        if len(agent_messages) >= max_messages:
                            break
        return agent_messages

    def _get_latest_code_artifact(self) -> Optional[str]:
        """
        Get latest code artifact from annotations to append to the user message
        """
        for message in reversed(self.messages):
            if (
                message.role == MessageRole.ASSISTANT
                and message.annotations is not None
            ):
                for annotation in message.annotations:
                    # type is tools and has `toolOutput` attribute
                    if annotation.type == "tools" and isinstance(
                        annotation.data, ArtifactAnnotation
                    ):
                        tool_output = annotation.data.toolOutput
                        if tool_output and not tool_output.get("isError", False):
                            output = tool_output.get("output", {})
                            if isinstance(output, dict) and output.get("code"):
                                return output.get("code")
                            else:
                                return None
        return None

    def get_history_messages(
        self,
        include_agent_messages: bool = False,
        include_code_artifact: bool = True,
    ) -> List[ChatMessage]:
        """
        Get the history messages
        """
        chat_messages = [
            ChatMessage(role=message.role, content=message.content)
            for message in self.messages[:-1]
        ]
        if include_agent_messages:
            agent_messages = self._get_agent_messages(max_messages=5)
            if len(agent_messages) > 0:
                message = ChatMessage(
                    role=MessageRole.ASSISTANT,
                    content="Previous agent events: \n" + "\n".join(agent_messages),
                )
                chat_messages.append(message)
        if include_code_artifact:
            latest_code_artifact = self._get_latest_code_artifact()
            if latest_code_artifact:
                message = ChatMessage(
                    role=MessageRole.ASSISTANT,
                    content=f"The existing code is:\n```\n{latest_code_artifact}\n```",
                )
                chat_messages.append(message)
        return chat_messages

    def is_last_message_from_user(self) -> bool:
        return self.messages[-1].role == MessageRole.USER

    def get_chat_document_ids(self) -> List[str]:
        """
        Get the document IDs from the chat messages
        """
        document_ids: List[str] = []
        uploaded_files = self.get_document_files()
        for _file in uploaded_files:
            refs = getattr(_file, "refs", None)
            if refs is not None:
                document_ids.extend(refs)
        return list(set(document_ids))

    def get_document_files(self) -> List[DocumentFile]:
        """
        Get the uploaded files from the chat data
        """
        uploaded_files = []
        for message in self.messages:
            if message.role == MessageRole.USER and message.annotations is not None:
                for annotation in message.annotations:
                    if annotation.type == "document_file" and isinstance(
                        annotation.data, AnnotationFileData
                    ):
                        uploaded_files.extend(annotation.data.files)
        return uploaded_files


class SourceNodes(BaseModel):
    id: str
    metadata: Dict[str, Any]
    score: Optional[float]
    text: str
    url: Optional[str]

    @classmethod
    def from_source_node(cls, source_node: NodeWithScore):
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
    def get_url_from_metadata(cls, metadata: Dict[str, Any]) -> Optional[str]:
        url_prefix = os.getenv("FILESERVER_URL_PREFIX")
        if not url_prefix:
            logger.warning(
                "Warning: FILESERVER_URL_PREFIX not set in environment variables. Can't use file server"
            )
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
            data_dir = os.path.abspath(DATA_DIR)
            if file_path and data_dir:
                relative_path = os.path.relpath(file_path, data_dir)
                return f"{url_prefix}/data/{relative_path}"
        # fallback to URL in metadata (e.g. for websites)
        return metadata.get("URL")

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
        serialization_alias="starterQuestions",
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
