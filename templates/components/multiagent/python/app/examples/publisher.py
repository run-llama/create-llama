from textwrap import dedent
from typing import List, Tuple

from app.agents.single import FunctionCallingAgent
from app.engine.tools import ToolFactory
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.tools import FunctionTool


def get_publisher_tools() -> Tuple[List[FunctionTool], str, str]:
    tools = []
    # Get configured tools from the tools.yaml file
    configured_tools = ToolFactory.from_env(map_result=True)
    if "document_generator" in configured_tools.keys():
        tools.extend(configured_tools["document_generator"])
        prompt_instructions = dedent("""
            Normally, reply the blog post content to the user directly. 
            But if user requested to generate a file, use the document_generator tool to generate the file and reply the link to the file.
        """)
        description = "Expert in publishing the blog post, able to publish the blog post in PDF or HTML format."
    else:
        prompt_instructions = "You don't have a tool to generate document. Please reply the content directly."
        description = "Expert in publishing the blog post"
    return tools, prompt_instructions, description


def create_publisher(chat_history: List[ChatMessage]):
    tools, prompt_instructions, description = get_publisher_tools()
    return FunctionCallingAgent(
        name="publisher",
        tools=tools,
        description=description,
        system_prompt=prompt_instructions,
        chat_history=chat_history,
    )
