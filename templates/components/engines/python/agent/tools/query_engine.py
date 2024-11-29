import os
from typing import Any, Dict, List, Optional, Sequence

from llama_index.core import get_response_synthesizer
from llama_index.core.base.base_query_engine import BaseQueryEngine
from llama_index.core.base.response.schema import RESPONSE_TYPE, Response
from llama_index.core.multi_modal_llms import MultiModalLLM
from llama_index.core.prompts.base import BasePromptTemplate
from llama_index.core.prompts.default_prompt_selectors import (
    DEFAULT_TEXT_QA_PROMPT_SEL,
)
from llama_index.core.query_engine.multi_modal import _get_image_and_text_nodes
from llama_index.core.response_synthesizers.base import BaseSynthesizer, QueryTextType
from llama_index.core.schema import (
    ImageNode,
    NodeWithScore,
)
from llama_index.core.tools.query_engine import QueryEngineTool
from llama_index.core.types import RESPONSE_TEXT_TYPE

from app.settings import get_multi_modal_llm


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
    multimodal_llm = get_multi_modal_llm()
    if multimodal_llm:
        kwargs["response_synthesizer"] = MultiModalSynthesizer(
            multimodal_model=multimodal_llm,
        )

    # If index is index is LlamaCloudIndex
    # use auto_routed mode for better query results
    if index.__class__.__name__ == "LlamaCloudIndex":
        if kwargs.get("retrieval_mode") is None:
            kwargs["retrieval_mode"] = "auto_routed"
        if multimodal_llm:
            kwargs["retrieve_image_nodes"] = True
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


class MultiModalSynthesizer(BaseSynthesizer):
    """
    A synthesizer that summarizes text nodes and uses a multi-modal LLM to generate a response.
    """

    def __init__(
        self,
        multimodal_model: MultiModalLLM,
        response_synthesizer: Optional[BaseSynthesizer] = None,
        text_qa_template: Optional[BasePromptTemplate] = None,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self._multi_modal_llm = multimodal_model
        self._response_synthesizer = response_synthesizer or get_response_synthesizer()
        self._text_qa_template = text_qa_template or DEFAULT_TEXT_QA_PROMPT_SEL

    def _get_prompts(self, **kwargs) -> Dict[str, Any]:
        return {
            "text_qa_template": self._text_qa_template,
        }

    def _update_prompts(self, prompts: Dict[str, Any]) -> None:
        if "text_qa_template" in prompts:
            self._text_qa_template = prompts["text_qa_template"]

    async def aget_response(
        self,
        *args,
        **response_kwargs: Any,
    ) -> RESPONSE_TEXT_TYPE:
        return await self._response_synthesizer.aget_response(*args, **response_kwargs)

    def get_response(self, *args, **kwargs) -> RESPONSE_TEXT_TYPE:
        return self._response_synthesizer.get_response(*args, **kwargs)

    async def asynthesize(
        self,
        query: QueryTextType,
        nodes: List[NodeWithScore],
        additional_source_nodes: Optional[Sequence[NodeWithScore]] = None,
        **response_kwargs: Any,
    ) -> RESPONSE_TYPE:
        image_nodes, text_nodes = _get_image_and_text_nodes(nodes)

        if len(image_nodes) == 0:
            return await self._response_synthesizer.asynthesize(query, text_nodes)

        # Summarize the text nodes to avoid exceeding the token limit
        text_response = str(
            await self._response_synthesizer.asynthesize(query, text_nodes)
        )

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

    def synthesize(
        self,
        query: QueryTextType,
        nodes: List[NodeWithScore],
        additional_source_nodes: Optional[Sequence[NodeWithScore]] = None,
        **response_kwargs: Any,
    ) -> RESPONSE_TYPE:
        image_nodes, text_nodes = _get_image_and_text_nodes(nodes)

        if len(image_nodes) == 0:
            return self._response_synthesizer.synthesize(query, text_nodes)

        # Summarize the text nodes to avoid exceeding the token limit
        text_response = str(self._response_synthesizer.synthesize(query, text_nodes))

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
