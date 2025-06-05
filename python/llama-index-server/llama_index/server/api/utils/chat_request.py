from typing import List, Optional

from llama_index.core.llms import DocumentBlock
from llama_index.core.types import ChatMessage, MessageRole
from llama_index.server.models.artifacts import Artifact
from llama_index.server.models.chat import ChatRequest
from llama_index.server.services.file import FileService
from llama_index.server.utils.chat_attachments import get_file_attachments


def get_artifacts(chat_request: ChatRequest) -> List[Artifact]:
    """
    Return a list of artifacts sorted by their creation time.
    Artifacts without a creation time are placed at the end.
    """
    return sorted(
        [
            artifact
            for artifact in (Artifact.from_message(m) for m in chat_request.messages)
            if artifact is not None
        ],
        key=lambda a: (a.created_at is None, a.created_at),
    )


def get_last_artifact(chat_request: ChatRequest) -> Optional[Artifact]:
    artifacts = get_artifacts(chat_request)
    return artifacts[-1] if len(artifacts) > 0 else None


def prepare_user_message(chat_request: ChatRequest) -> ChatMessage:
    """
    Prepare the user message from the chat request.
    """
    last_message: ChatMessage = chat_request.messages[-1].to_llamaindex_message()
    if last_message.role != MessageRole.USER:
        raise ValueError("Last message must be from user")

    # Add attached files to the user message
    attachment_files = get_file_attachments(chat_request.messages)
    last_message.blocks += [
        DocumentBlock(
            path=file.path or FileService.get_file_path(file.id),
            url=file.url,
            document_mimetype=file.type,
        )
        for file in attachment_files
    ]

    return last_message
