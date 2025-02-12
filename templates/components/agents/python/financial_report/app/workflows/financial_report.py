from typing import Any, Dict, Optional, Tuple, Type

from llama_index.core import Settings
from llama_index.core.agent.workflow import (
    AgentWorkflow,
    FunctionAgent,
    ReActAgent,
)
from llama_index.core.llms import LLM
from llama_index.core.tools import FunctionTool, QueryEngineTool

from app.engine.index import IndexConfig, get_index
from app.engine.tools import ToolFactory
from app.engine.tools.query_engine import get_query_engine_tool


def create_workflow(
    params: Optional[Dict[str, Any]] = None,
    **kwargs,
):
    query_engine_tool, code_interpreter_tool, document_generator_tool = _prepare_tools(
        params, **kwargs
    )
    agent_cls = _get_agent_cls_from_llm(Settings.llm)
    research_agent = agent_cls(
        name="researcher",
        description="A financial researcher who are given a tasks that need to look up information from the financial documents about the user's request.",
        tools=[query_engine_tool],
        system_prompt="""
        You are a financial researcher who are given a tasks that need to look up information from the financial documents about the user's request.
        You should use the query engine tool to look up the information and return the result to the user.
        Always handoff the task to the `analyst` agent after gathering information.
        """,
        llm=Settings.llm,
        can_handoff_to=["analyst"],
    )

    analyst_agent = agent_cls(
        name="analyst",
        description="A financial analyst who takes responsibility to analyze the financial data and generate a report.",
        tools=[code_interpreter_tool],
        system_prompt="""
        Use the given information, don't make up anything yourself.
        If you have enough numerical information, it's good to include some charts/visualizations to the report so you can use the code interpreter tool to generate a report.
        You can use the code interpreter tool to generate a report.
        Always handoff the task and pass the researched information to the `reporter` agent.
        """,
        llm=Settings.llm,
        can_handoff_to=["reporter"],
    )

    reporter_agent = agent_cls(
        name="reporter",
        description="A reporter who takes responsibility to generate a document for a report content.",
        tools=[document_generator_tool],
        system_prompt="""
        Use the document generator tool to generate the document and return the result to the user.
        Don't update the content of the document, just generate a new one.
        After generating the document, tell the user for the content or the issue if there is any.
        """,
        llm=Settings.llm,
    )

    workflow = AgentWorkflow(
        agents=[research_agent, analyst_agent, reporter_agent],
        root_agent="researcher",
        verbose=True,
    )

    return workflow


def _get_agent_cls_from_llm(llm: LLM) -> Type[FunctionAgent | ReActAgent]:
    if llm.metadata.is_function_calling_model:
        return FunctionAgent
    else:
        return ReActAgent


def _prepare_tools(
    params: Optional[Dict[str, Any]] = None,
    **kwargs,
) -> Tuple[QueryEngineTool, FunctionTool, FunctionTool]:
    # Create query engine tool
    index_config = IndexConfig(**params)
    index = get_index(index_config)
    if index is None:
        raise ValueError(
            "Index is not found. Try run generation script to create the index first."
        )
    query_engine_tool = get_query_engine_tool(index=index)

    configured_tools: Dict[str, FunctionTool] = ToolFactory.from_env(map_result=True)  # type: ignore
    code_interpreter_tool = configured_tools.get("interpret")
    document_generator_tool = configured_tools.get("generate_document")

    return query_engine_tool, code_interpreter_tool, document_generator_tool
