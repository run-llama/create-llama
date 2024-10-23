from textwrap import dedent
from typing import List, Tuple

from app.engine.tools import ToolFactory
from app.workflows.single import FunctionCallingAgent
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.tools import FunctionTool


def _get_analyst_params() -> Tuple[List[type[FunctionTool]], str, str]:
    tools = []
    prompt_instructions = dedent(
        """
        You are an expert in analyzing financial data.
        You are given a task and a set of financial data to analyze. Your task is to analyze the financial data and return a report.
        Your response should include a detailed analysis of the financial data, including any trends, patterns, or insights that you find.
        Construct the analysis in a textual format like tables would be great!
        Don't need to synthesize the data, just analyze and provide your findings.
        Always use the provided information, don't make up any information yourself.
        """
    )
    description = "Expert in analyzing financial data"
    configured_tools = ToolFactory.from_env(map_result=True)
    # Check if the interpreter tool is configured
    if "interpreter" in configured_tools.keys():
        tools.extend(configured_tools["interpreter"])
        prompt_instructions += dedent("""
            You are able to visualize the financial data using code interpreter tool.
            It's very useful to create and include visualizations to the report (make sure you include the right code and data for the visualization).
            Never include any code into the report, just the visualization.
        """)
        description += (
            ", able to visualize the financial data using code interpreter tool."
        )
    return tools, prompt_instructions, description


def create_analyst(chat_history: List[ChatMessage]):
    tools, prompt_instructions, description = _get_analyst_params()

    return FunctionCallingAgent(
        name="analyst",
        tools=tools,
        description=description,
        system_prompt=dedent(prompt_instructions),
        chat_history=chat_history,
    )
