from typing import List, Optional

from llama_index.core import QueryBundle
from llama_index.core.postprocessor.types import BaseNodePostprocessor
from llama_index.core.schema import NodeWithScore


class NodeCitationProcessor(BaseNodePostprocessor):
    """
    Add a new field `citation_id` to the metadata of the node by copying the id from the node.
    Useful for citation construction.
    """

    def _postprocess_nodes(
        self,
        nodes: List[NodeWithScore],
        query_bundle: Optional[QueryBundle] = None,
    ) -> List[NodeWithScore]:
        for node_score in nodes:
            node_score.node.metadata["citation_id"] = node_score.node.node_id
        return nodes
