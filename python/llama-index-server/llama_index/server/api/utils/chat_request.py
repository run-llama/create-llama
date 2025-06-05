from typing import List, Optional

from llama_index.server.models.artifacts import Artifact
from llama_index.server.models.chat import ChatRequest


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
