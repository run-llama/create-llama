from enum import Enum
from typing import List, Optional

from llama_index.core.schema import NodeWithScore
from llama_index.core.workflow import Event

from app.api.routers.models import SourceNodes


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


class SourceNodesEvent(Event):
    nodes: List[NodeWithScore]

    def to_response(self):
        return {
            "type": "sources",
            "data": {
                "nodes": [
                    SourceNodes.from_source_node(node).model_dump()
                    for node in self.nodes
                ]
            },
        }
