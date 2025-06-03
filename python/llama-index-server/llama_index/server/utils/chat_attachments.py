from typing import List

from llama_index.server.models.chat import ChatRequest, FileAnnotation, ServerFile


def get_file_attachments(chat_request: ChatRequest) -> List[ServerFile]:
    """
    Extract all file attachments from the chat request.

    Args:
        chat_request (ChatRequest): The chat request.

    Returns:
        List[PrivateFile]: The list of private files.
    """
    message_annotations = [
        message.annotations for message in chat_request.messages if message.annotations
    ]
    files: List[ServerFile] = []
    for annotation in message_annotations:
        if isinstance(annotation, list):
            for item in annotation:
                if isinstance(item, FileAnnotation):
                    files.extend(item.data.files)
    return files
