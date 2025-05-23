import os
from typing import Any, Optional

from llama_index.core.base.base_query_engine import BaseQueryEngine
from llama_index.core.tools.query_engine import QueryEngineTool
from llama_index.core.response_synthesizers import TreeSummarize
from llama_index.core.prompts import PromptTemplate
from llama_index.core.indices.base import BaseIndex
from llama_index.server.prompts import CITATION_PROMPT
from llama_index.server.tools.index.node_citation_processor import NodeCitationProcessor


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
        qa_prompt = PromptTemplate(
            template=os.getenv("CITATION_PROMPT", CITATION_PROMPT)
        )
        kwargs["node_postprocessors"] = [NodeCitationProcessor()]
        kwargs["response_synthesizer"] = TreeSummarize(
            verbose=True, summary_template=qa_prompt
        )

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
        description = (
            "Use this tool to retrieve information about the text corpus from an index."
        )
        if enable_citation:
            description += (
                "\nThe output could include citations with the format [citation:id]. "
                "Don't trim out the citations in the final response to the user."
            )
    query_engine = create_query_engine(index, enable_citation=enable_citation, **kwargs)
    return QueryEngineTool.from_defaults(
        query_engine=query_engine,
        name=name,
        description=description,
    )
