import logging
import os
from typing import Any, Optional

from llama_index.core.base.base_query_engine import BaseQueryEngine
from llama_index.core.indices.base import BaseIndex
from llama_index.core.prompts import PromptTemplate
from llama_index.core.response_synthesizers import Accumulate
from llama_index.core.tools.query_engine import QueryEngineTool
from llama_index.server.prompts import CITATION_PROMPT
from llama_index.server.tools.index.node_citation_processor import NodeCitationProcessor

logger = logging.getLogger(__name__)


def create_query_engine(
    index: BaseIndex, enable_citation: bool = True, **kwargs: Any
) -> BaseQueryEngine:
    """
    Create a query engine for the given index.

    Args:
        index: The index to create a query engine for.
        enable_citation: Whether to enable citation in the response of the tool.
        params (optional): Additional parameters for the query engine, e.g: similarity_top_k
    """
    top_k = int(os.getenv("TOP_K", 0))
    if top_k != 0 and kwargs.get("filters") is None:
        kwargs["similarity_top_k"] = top_k

    if enable_citation:
        if kwargs.get("response_synthesizer") is not None:
            # We don't override the provided response synthesizer
            # Just show a warning
            logger.warning(
                "Custom response synthesizer and citation are both used. The citation might not work as intended."
            )
        else:
            kwargs["response_synthesizer"] = Accumulate(
                text_qa_template=PromptTemplate(
                    template=os.getenv("CITATION_PROMPT", CITATION_PROMPT)
                ),
            )
        kwargs["node_postprocessors"] = kwargs.get("node_postprocessors", []) + [
            NodeCitationProcessor()
        ]

    return index.as_query_engine(**kwargs)


def get_query_engine_tool(
    index: BaseIndex,
    name: Optional[str] = None,
    description: Optional[str] = None,
    enable_citation: bool = True,
    **kwargs: Any,
) -> QueryEngineTool:
    """
    Get a query engine tool for the given index.

    Args:
        index: The index to create a query engine for.
        name (optional): The name of the tool.
        description (optional): The description of the tool.
        enable_citation (optional): Whether to enable citation in the response of the tool.
    """
    if name is None:
        name = "query_index"
    if description is None:
        description = "Use this tool to retrieve information from a knowledge base. Provide a specific query and can call the tool multiple times if necessary."
    if enable_citation:
        description += "\nThe output would include citations with the format [citation:id] for each chunk of information in the knowledge base."
    query_engine = create_query_engine(index, enable_citation=enable_citation, **kwargs)
    tool = QueryEngineTool.from_defaults(
        query_engine=query_engine,
        name=name,
        description=description,
    )
    tool.citation_system_prompt = "Answer the user question with citations for the parts that uses the information from the knowledge base."
    return tool
