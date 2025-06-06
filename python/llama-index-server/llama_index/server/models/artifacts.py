import logging
from enum import Enum
from typing import List, Literal, Optional, Union

from llama_index.core.workflow.events import Event
from llama_index.server.models.chat import ChatAPIMessage
from pydantic import BaseModel
from llama_index.server.utils.inline import get_inline_annotations

logger = logging.getLogger(__name__)


class ArtifactType(str, Enum):
    CODE = "code"
    DOCUMENT = "document"


class CodeArtifactData(BaseModel):
    file_name: str
    code: str
    language: str


class DocumentArtifactSource(BaseModel):
    id: str
    # we can add more fields here


class DocumentArtifactData(BaseModel):
    title: str
    content: str
    type: Literal["markdown", "html"]
    sources: Optional[List[DocumentArtifactSource]] = None


class Artifact(BaseModel):
    created_at: Optional[int] = None
    type: ArtifactType
    data: Union[CodeArtifactData, DocumentArtifactData]

    @classmethod
    def from_message(cls, message: ChatAPIMessage) -> Optional["Artifact"]:
        inline_annotations = get_inline_annotations(message)

        for annotation in inline_annotations:
            if isinstance(annotation, dict) and annotation.get("type") == "artifact":
                try:
                    artifact = cls.model_validate(annotation.get("data"))
                    return artifact
                except Exception as e:
                    logger.warning(
                        f"Failed to parse artifact from annotation: {annotation}. Error: {e}"
                    )

        return None


class ArtifactEvent(Event):
    type: str = "artifact"
    data: Artifact

    def to_response(self) -> dict:
        return {
            "type": self.type,
            "data": self.data.model_dump(),
        }
