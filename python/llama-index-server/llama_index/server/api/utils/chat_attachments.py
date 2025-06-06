from typing import List

from llama_index.core.types import MessageRole
from llama_index.server.models.chat import ChatAPIMessage, FileAnnotation
from llama_index.server.models.file import ServerFile
from llama_index.server.services.file import FileService


def get_file_attachments(messages: List[ChatAPIMessage]) -> List[ServerFile]:
    """
    Extract all file attachments from user messages.

    Args:
        messages (List[ChatAPIMessage]): The list of messages.

    Returns:
        List[ServerFile]: The list of private files.
    """
    user_message_annotations = [
        message.annotations
        for message in messages
        if message.annotations and message.role == MessageRole.USER
    ]
    files: List[ServerFile] = []
    for annotation in user_message_annotations:
        if isinstance(annotation, list):
            for item in annotation:
                if isinstance(item, FileAnnotation):
                    server_files = [
                        ServerFile(
                            id=file.id,
                            type=file.type,
                            size=file.size,
                            url=file.url,
                            path=FileService.get_file_path(file.id),
                        )
                        for file in item.data.files
                    ]
                    files.extend(server_files)
    return files
