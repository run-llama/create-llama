from typing import Any, Dict, List, Literal

from llama_index.core.schema import NodeWithScore
from llama_index.core.workflow import Event

from app.api.routers.models import SourceNodes


# Workflow events
class PlanResearchEvent(Event):
    pass


class ResearchEvent(Event):
    question_id: str
    question: str
    context_nodes: List[NodeWithScore]


class CollectAnswersEvent(Event):
    question_id: str
    question: str
    answer: str


class WriteReportEvent(Event):
    pass


# Stream events
class DataEvent(Event):
    type: Literal["retrieve", "analyze", "answer", "sources"]
    state: Literal["pending", "inprogress", "done", "error"]
    data: Dict[str, Any]

    def to_response(self):
        return self.model_dump()


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
