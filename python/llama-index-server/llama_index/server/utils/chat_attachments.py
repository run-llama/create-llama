from typing import List

from llama_index.server.models.chat import AttachmentType, ChatRequest
from llama_index.server.services.file import PrivateFile


def get_file_attachments(chat_request: ChatRequest) -> List[PrivateFile]:
    """
    Extract all file attachments from the chat request.

    Args:
        chat_request (ChatRequest): The chat request.

    Returns:
        List[PrivateFile]: The list of private files.
    """
    all_attachments = chat_request.data.attachments if chat_request.data else []
    private_files = []
    for attachment in all_attachments:
        if attachment.type == AttachmentType.FILE and isinstance(
            attachment.data, PrivateFile
        ):
            private_files.append(attachment.data)
    return private_files
