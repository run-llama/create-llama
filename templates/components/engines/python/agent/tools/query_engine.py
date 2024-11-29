import os
from typing import Any, List, Optional, Sequence

from llama_index.core.base.base_query_engine import BaseQueryEngine
from llama_index.core.base.response.schema import RESPONSE_TYPE, Response
from llama_index.core.multi_modal_llms import MultiModalLLM
from llama_index.core.prompts.base import BasePromptTemplate
from llama_index.core.prompts.default_prompt_selectors import (
    DEFAULT_TREE_SUMMARIZE_PROMPT_SEL,
)
from llama_index.core.query_engine import (
    RetrieverQueryEngine,
)
from llama_index.core.query_engine.multi_modal import _get_image_and_text_nodes
from llama_index.core.response_synthesizers import TreeSummarize
from llama_index.core.response_synthesizers.base import QueryTextType
from llama_index.core.schema import (
    ImageNode,
    NodeWithScore,
)
from llama_index.core.tools.query_engine import QueryEngineTool

from app.settings import multi_modal_llm


class MultiModalSynthesizer(TreeSummarize):
    """
    A synthesizer that summarizes text nodes and uses a multi-modal LLM to generate a response.
    """

    def __init__(
        self,
        multimodal_model: Optional[MultiModalLLM] = None,
        text_qa_template: Optional[BasePromptTemplate] = None,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self._multi_modal_llm = multimodal_model
        self._text_qa_template = text_qa_template or DEFAULT_TREE_SUMMARIZE_PROMPT_SEL

    def synthesize(
        self,
        query: QueryTextType,
        nodes: List[NodeWithScore],
        additional_source_nodes: Optional[Sequence[NodeWithScore]] = None,
        **response_kwargs: Any,
    ) -> RESPONSE_TYPE:
        image_nodes, text_nodes = _get_image_and_text_nodes(nodes)

        # Summarize the text nodes to avoid exceeding the token limit
        text_response = str(super().synthesize(query, nodes))

        fmt_prompt = self._text_qa_template.format(
            context_str=text_response,
            query_str=query.query_str,  # type: ignore
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
        query: QueryTextType,
        nodes: List[NodeWithScore],
        additional_source_nodes: Optional[Sequence[NodeWithScore]] = None,
        **response_kwargs: Any,
    ) -> RESPONSE_TYPE:
        image_nodes, text_nodes = _get_image_and_text_nodes(nodes)

        # Summarize the text nodes to avoid exceeding the token limit
        text_response = str(await super().asynthesize(query, nodes))

        fmt_prompt = self._text_qa_template.format(
            context_str=text_response,
            query_str=query.query_str,  # type: ignore
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
            mm_model = multi_modal_llm.get()
            if mm_model:
                kwargs["retrieve_image_nodes"] = True
                print("Using multi-modal model")
                return RetrieverQueryEngine(
                    retriever=index.as_retriever(**kwargs),
                    response_synthesizer=MultiModalSynthesizer(
                        multimodal_model=mm_model
                    ),
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
