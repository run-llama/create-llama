from typing import Any, Dict, Optional, Type

from llama_index.core import Settings
from llama_index.core.agent.workflow import (
    AgentWorkflow,
    FunctionAgent,
    ReActAgent,
)
from llama_index.core.llms import LLM

from app.engine.index import IndexConfig, get_index
from app.engine.tools import ToolFactory
from app.engine.tools.query_engine import get_query_engine_tool


def create_workflow(
    params: Optional[Dict[str, Any]] = None,
    **kwargs,
) -> AgentWorkflow:
    # Create query engine tool
    index_config = IndexConfig(**params)
    index = get_index(index_config)
    if index is None:
        query_engine_tool = None
    else:
        query_engine_tool = get_query_engine_tool(index=index)

    configured_tools = ToolFactory.from_env(map_result=True)
    extractor_tool = configured_tools.get("extract_questions")  # type: ignore
    filling_tool = configured_tools.get("fill_form")  # type: ignore

    if extractor_tool is None or filling_tool is None:
        raise ValueError("Extractor and filling tools are required.")

    agent_cls = _get_agent_cls_from_llm(Settings.llm)

    extractor_agent = agent_cls(
        name="extractor",
        description="An agent that extracts missing cells from CSV files and generates questions to fill them.",
        tools=[extractor_tool],
        system_prompt="""
        You are a helpful assistant who extracts missing cells from CSV files.
        Only extract missing cells from CSV files and generate questions to fill them.
        Always handoff the task to the `researcher` agent after extracting the questions.
        """,
        llm=Settings.llm,
        can_handoff_to=["researcher"],
    )

    researcher_agent = agent_cls(
        name="researcher",
        description="An agent that finds answers to questions about missing cells.",
        tools=[query_engine_tool] if query_engine_tool else [],
        system_prompt="""
        You are a researcher who finds answers to questions about missing cells.
        Only use provided data - never make up any information yourself. Use N/A if an answer is not found.
        Always handoff the task to the `processor` agent after finding the answers.
        """,
        llm=Settings.llm,
        can_handoff_to=["processor"],
    )

    processor_agent = agent_cls(
        name="processor",
        description="An agent that fills missing cells with found answers.",
        tools=[filling_tool],
        system_prompt="""
        You are a processor who fills missing cells with found answers.
        Fill N/A for any missing answers.
        After filling the cells, tell the user about the results or any issues encountered.
        """,
        llm=Settings.llm,
    )

    workflow = AgentWorkflow(
        agents=[extractor_agent, researcher_agent, processor_agent],
        root_agent="extractor",
        verbose=True,
    )

    return workflow


def _get_agent_cls_from_llm(llm: LLM) -> Type[FunctionAgent | ReActAgent]:
    if llm.metadata.is_function_calling_model:
        return FunctionAgent
    else:
        return ReActAgent
