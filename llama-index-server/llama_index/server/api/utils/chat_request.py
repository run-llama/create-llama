from typing import List, Optional

from llama_index.server.api.models import Artifact, ChatRequest


def get_artifacts(chat_request: ChatRequest) -> List[Artifact]:
    return [
        Artifact.from_message(message)  # type: ignore
        for message in chat_request.messages
        if Artifact.from_message(message) is not None
    ]


def get_last_artifact(chat_request: ChatRequest) -> Optional[Artifact]:
    artifacts = get_artifacts(chat_request)
    return artifacts[-1] if len(artifacts) > 0 else None
