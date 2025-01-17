from enum import Enum
from typing import Any, Dict, List, Literal

from llama_index.core.base.llms.types import (
    CompletionResponse,
    CompletionResponseAsyncGen,
)
from llama_index.core.schema import Node, NodeWithScore
from llama_index.core.workflow import Event


class RetrieveSource(Enum):
    WEB = "web"
    DOCUMENTS = "documents"


## Workflow events


class PlanResearchEvent(Event):
    pass


class ResearchEvent(Event):
    question_id: str
    question: str
    context_nodes: List[NodeWithScore | Node]


class CollectAnswersEvent(Event):
    question_id: str
    question: str
    answer: str


class WriteReportEvent(Event):
    pass


## Stream events
class ResponseChunkEvent(Event):
    """
    Event to stream the response chunk
    """

    response: CompletionResponse | CompletionResponseAsyncGen

    async def __aiter__(self):
        if isinstance(self.response, CompletionResponse):
            yield self.response
        else:
            async for chunk in self.response:
                yield chunk


class DataEvent(Event):
    type: Literal["retrieve", "analyze", "answer", "sources"]
    state: Literal["pending", "inprogress", "done", "error"]
    data: Dict[str, Any]


class SourceNodesEvent(Event):
    nodes: List[NodeWithScore]
