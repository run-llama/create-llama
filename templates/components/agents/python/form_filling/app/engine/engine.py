import os
from typing import Any, List, Optional

from app.engine.index import get_index
from app.engine.tools import ToolFactory
from app.engine.workflow import FormFillingWorkflow
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.indices.vector_store import VectorStoreIndex
from llama_index.core.tools import QueryEngineTool
from llama_index.core.workflow import Workflow


def get_chat_engine(
    chat_history: Optional[List[ChatMessage]] = None, **kwargs
) -> Workflow:
    index: VectorStoreIndex = get_index()
    if index is None:
        raise ValueError(
            "Index is not found! Please run `poetry run generate` to create an index."
        )
    top_k = int(os.getenv("TOP_K", 10))
    query_engine = index.as_query_engine(similarity_top_k=top_k)
    query_engine_tool = QueryEngineTool.from_defaults(query_engine=query_engine)

    configured_tools: dict[str, list[Any]] = ToolFactory.from_env(map_result=True)
    form_filling_tools = configured_tools.get("form_filling", [])
    if not form_filling_tools:
        raise ValueError("Form filling tool is missing!")

    # TODO: Separate the extract question and fill form tools
    extractor_tool = next(
        (
            tool
            for tool in form_filling_tools
            if tool.metadata.get_name() == "extract_questions"
        ),
        None,
    )
    filling_tool = next(
        (
            tool
            for tool in form_filling_tools
            if tool.metadata.get_name() == "fill_form"
        ),
        None,
    )

    workflow = FormFillingWorkflow(
        query_engine_tool=query_engine_tool,
        extractor_tool=extractor_tool,
        filling_tool=filling_tool,
        chat_history=chat_history,
    )

    return workflow
