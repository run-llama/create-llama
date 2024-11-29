import os
from typing import List, Optional, Sequence

from llama_index.core.base.base_query_engine import BaseQueryEngine
from llama_index.core.base.response.schema import RESPONSE_TYPE, Response
from llama_index.core.query_engine import SimpleMultiModalQueryEngine
from llama_index.core.query_engine.multi_modal import _get_image_and_text_nodes
from llama_index.core.response_synthesizers import (
    BaseSynthesizer,
    get_response_synthesizer,
)
from llama_index.core.response_synthesizers.type import ResponseMode
from llama_index.core.schema import ImageNode, NodeWithScore, QueryBundle
from llama_index.core.tools.query_engine import QueryEngineTool

from app.settings import multi_modal_llm


class MultiModalQueryEngine(SimpleMultiModalQueryEngine):
    """
    A multi-modal query engine that splits the retrieval results into chunks then summarizes each chunk to reduce the number of tokens in the response.
    """

    def __init__(
        self,
        text_synthesizer: Optional[BaseSynthesizer] = None,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        # Use a response synthesizer for text nodes summarization
        self._text_synthesizer = text_synthesizer or get_response_synthesizer(
            streaming=False,
            response_mode=ResponseMode.TREE_SUMMARIZE,
        )

    def _summarize_text_nodes(
        self, query_bundle: QueryBundle, nodes: List[NodeWithScore]
    ) -> str:
        """
        Synthesize a response for the query using the retrieved nodes.
        """
        return str(
            self._text_synthesizer.synthesize(
                query=query_bundle,
                nodes=nodes,
                streaming=False,
            )
        )

    def synthesize(
        self,
        query_bundle: QueryBundle,
        nodes: List[NodeWithScore],
    ) -> RESPONSE_TYPE:
        image_nodes, text_nodes = _get_image_and_text_nodes(nodes)
        # Summarize the text nodes
        text_response = self._summarize_text_nodes(
            query_bundle=query_bundle,
            nodes=text_nodes,
        )

        fmt_prompt = self._text_qa_template.format(
            context_str=text_response,
            query_str=query_bundle.query_str,
        )

        llm_response = self._multi_modal_llm.complete(
            prompt=fmt_prompt,
            image_documents=[
                image_node.node
                for image_node in image_nodes
                if isinstance(image_node.node, ImageNode)
            ],
        )

        return Response(
            response=str(llm_response),
            source_nodes=nodes,
            metadata={"text_nodes": text_nodes, "image_nodes": image_nodes},
        )

    async def asynthesize(
        self,
        query_bundle: QueryBundle,
        nodes: List[NodeWithScore],
        additional_source_nodes: Optional[Sequence[NodeWithScore]] = None,
    ) -> RESPONSE_TYPE:
        image_nodes, text_nodes = _get_image_and_text_nodes(nodes)
        # Summarize the text nodes to avoid exceeding the token limit
        text_response = self._summarize_text_nodes(
            query_bundle=query_bundle,
            nodes=text_nodes,
        )

        fmt_prompt = self._text_qa_template.format(
            context_str=text_response,
            query_str=query_bundle.query_str,
        )

        llm_response = await self._multi_modal_llm.acomplete(
            prompt=fmt_prompt,
            image_documents=[
                image_node.node
                for image_node in image_nodes
                if isinstance(image_node.node, ImageNode)
            ],
        )

        return Response(
            response=str(llm_response),
            source_nodes=nodes,
            metadata={"text_nodes": text_nodes, "image_nodes": image_nodes},
        )


def create_query_engine(index, **kwargs) -> BaseQueryEngine:
    """
    Create a query engine for the given index.

    Args:
        index: The index to create a query engine for.
        params (optional): Additional parameters for the query engine, e.g: similarity_top_k
    """
    top_k = int(os.getenv("TOP_K", 0))
    if top_k != 0 and kwargs.get("filters") is None:
        kwargs["similarity_top_k"] = top_k
    # If index is index is LlamaCloudIndex
    # use auto_routed mode for better query results
    if index.__class__.__name__ == "LlamaCloudIndex":
        retrieval_mode = kwargs.get("retrieval_mode")
        if retrieval_mode is None:
            kwargs["retrieval_mode"] = "auto_routed"
            if multi_modal_llm:
                # Note: image nodes are not supported for auto_routed or chunk retrieval mode
                kwargs["retrieve_image_nodes"] = True
                return MultiModalQueryEngine(
                    retriever=index.as_retriever(**kwargs),
                    multi_modal_llm=multi_modal_llm,
                )

    return index.as_query_engine(**kwargs)


def get_query_engine_tool(
    index,
    name: Optional[str] = None,
    description: Optional[str] = None,
    **kwargs,
) -> QueryEngineTool:
    """
    Get a query engine tool for the given index.

    Args:
        index: The index to create a query engine for.
        name (optional): The name of the tool.
        description (optional): The description of the tool.
    """
    if name is None:
        name = "query_index"
    if description is None:
        description = (
            "Use this tool to retrieve information about the text corpus from an index."
        )
    query_engine = create_query_engine(index, **kwargs)
    return QueryEngineTool.from_defaults(
        query_engine=query_engine,
        name=name,
        description=description,
    )
