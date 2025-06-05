from typing import List

from llama_index.core.types import MessageRole
from llama_index.server.models.chat import ChatAPIMessage, FileAnnotation, ServerFile


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
                    files.extend(item.data.files)
    return files
