import logging
from enum import Enum
from typing import Optional

from pydantic import BaseModel

from llama_index.core.workflow import Event

logger = logging.getLogger("uvicorn")


class AgentRunEventType(Enum):
    TEXT = "text"
    PROGRESS = "progress"


class AgentRunEvent(Event):
    name: str
    msg: str
    event_type: AgentRunEventType = AgentRunEventType.TEXT
    data: Optional[dict] = None

    def to_response(self) -> dict:
        return {
            "type": "agent",
            "data": {
                "agent": self.name,
                "type": self.event_type.value,
                "text": self.msg,
                "data": self.data,
            },
        }


class ComponentDefinition(BaseModel):
    type: str
    code: str
    filename: str


class UIEvent(Event):
    type: str
    data: BaseModel

    def to_response(self) -> dict:
        return {
            "type": self.type,
            "data": self.data.model_dump(),
        }
