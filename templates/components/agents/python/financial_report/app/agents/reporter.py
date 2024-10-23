from textwrap import dedent
from typing import List, Tuple

from app.engine.tools import ToolFactory
from app.workflows.single import FunctionCallingAgent
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.tools import BaseTool


def _get_reporter_params(
    chat_history: List[ChatMessage],
) -> Tuple[List[type[BaseTool]], str, str]:
    tools: List[type[BaseTool]] = []
    description = "Expert in representing a financial report"
    prompt_instructions = dedent(
        """
        You are a report generation assistant tasked with producing a well-formatted report given parsed context.
        Given a comprehensive analysis of the user request, your task is to synthesize the information and return a well-formatted report.

        ## Instructions
        You are responsible for representing the analysis in a well-formatted report. If tables or visualizations provided, add them to the right sections that are most relevant.
        Use only the provided information to create the report. Do not make up any information yourself.
        Finally, the report should be presented in markdown format.
        """
    )
    configured_tools = ToolFactory.from_env(map_result=True)
    if "document_generator" in configured_tools:  # type: ignore
        tools.extend(configured_tools["document_generator"])  # type: ignore
        prompt_instructions += (
            "\nYou are also able to generate a file document (PDF/HTML) of the report."
        )
        description += " and generate a file document (PDF/HTML) of the report."
    return tools, description, prompt_instructions


def create_reporter(chat_history: List[ChatMessage]):
    tools, description, prompt_instructions = _get_reporter_params(chat_history)
    return FunctionCallingAgent(
        name="reporter",
        tools=tools,
        description=description,
        system_prompt=prompt_instructions,
        chat_history=chat_history,
    )
