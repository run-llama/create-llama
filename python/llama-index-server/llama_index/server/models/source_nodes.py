from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from llama_index.core.schema import NodeWithScore
from llama_index.core.workflow.events import Event
from llama_index.server.utils.chat_file import get_file_url_from_metadata


class SourceNodesEvent(Event):
    nodes: List[NodeWithScore]

    def to_response(self) -> dict:
        return {
            "type": "sources",
            "data": {
                "nodes": [
                    SourceNodes.from_source_node(node).model_dump()
                    for node in self.nodes
                ]
            },
        }


class SourceNodes(BaseModel):
    id: str
    metadata: Dict[str, Any]
    score: Optional[float]
    text: str
    url: Optional[str]

    @classmethod
    def from_source_node(cls, source_node: NodeWithScore) -> "SourceNodes":
        metadata = source_node.node.metadata
        url = get_file_url_from_metadata(metadata)

        return cls(
            id=source_node.node.node_id,
            metadata=metadata,
            score=source_node.score,
            text=source_node.node.text,  # type: ignore
            url=url,
        )

    @classmethod
    def from_source_nodes(
        cls, source_nodes: List[NodeWithScore]
    ) -> List["SourceNodes"]:
        return [cls.from_source_node(node) for node in source_nodes]
