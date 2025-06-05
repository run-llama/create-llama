import logging
from typing import Any, List, Optional

from llama_index.core import QueryBundle
from llama_index.core.postprocessor.types import BaseNodePostprocessor
from llama_index.core.prompts import PromptTemplate
from llama_index.core.query_engine.retriever_query_engine import RetrieverQueryEngine
from llama_index.core.response_synthesizers import Accumulate
from llama_index.core.schema import NodeWithScore
from llama_index.core.tools.query_engine import QueryEngineTool
from llama_index.server.prompts import CITATION_PROMPT

logger = logging.getLogger(__name__)


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


class CitationSynthesizer(Accumulate):
    """
    Overload the Accumulate synthesizer to:
    1. Update prepare node metadata for citation id
    2. Update text_qa_template to include citations
    """

    def __init__(self, **kwargs: Any) -> None:
        text_qa_template = kwargs.pop("text_qa_template", None)
        if text_qa_template is None:
            text_qa_template = PromptTemplate(template=CITATION_PROMPT)
        super().__init__(text_qa_template=text_qa_template, **kwargs)


# Add this prompt to your agent system prompt
CITATION_SYSTEM_PROMPT = (
    "\nAnswer the user question using the response from the query tool. "
    "It's important to respect the citation information in the response. "
    "Don't mix up the citation_id, keep them at the correct fact."
)


def enable_citation(query_engine_tool: QueryEngineTool) -> QueryEngineTool:
    """
    Enable citation for a query engine tool by using CitationSynthesizer and NodePostprocessor.
    Note: This function will override the response synthesizer of your query engine.
    """
    query_engine = query_engine_tool.query_engine
    if not isinstance(query_engine, RetrieverQueryEngine):
        raise ValueError(
            "Citation feature requires a RetrieverQueryEngine. Your tool's query engine is a "
            f"{type(query_engine)}."
        )
    # Update the response synthesizer and node postprocessors
    query_engine._response_synthesizer = CitationSynthesizer()
    query_engine._node_postprocessors += [NodeCitationProcessor()]
    query_engine_tool._query_engine = query_engine

    # Update tool metadata
    query_engine_tool.metadata.description += "\nThe output will include citations with the format [citation:id] for each chunk of information in the knowledge base."
    return query_engine_tool
