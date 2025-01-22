from typing import List, Literal, Optional

from llama_index.core.schema import NodeWithScore
from llama_index.core.workflow import Event
from pydantic import BaseModel


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


class ReportEvent(Event):
    pass


# Events that are streamed to the frontend and rendered there
class DeepResearchEventData(BaseModel):
    event: Literal["retrieve", "analyze", "answer"]
    state: Literal["pending", "inprogress", "done", "error"]
    id: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None


class DataEvent(Event):
    type: Literal["deep_research_event"]
    data: DeepResearchEventData

    def to_response(self):
        return self.model_dump()
