from typing import List, Optional
from enum import Enum
from llama_index.core.base.llms.types import ChatMessage
from llama_index.core.tools import ToolSelection
from llama_index.core.workflow import Event


class AgentRunEventType(Enum):
    TEXT = "text"
    PROGRESS = "progress"


class AgentRunEvent(Event):
    name: str
    msg: str
    event_type: AgentRunEventType = AgentRunEventType.TEXT
    data: Optional[dict] = None


class InputEvent(Event):
    input: List[ChatMessage]
    response: bool = False


class ResearchEvent(Event):
    input: list[ToolSelection]
