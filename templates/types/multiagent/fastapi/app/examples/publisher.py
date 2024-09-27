from typing import List

from app.agents.single import FunctionCallingAgent
from app.tools.document_generator import DocumentGenerator
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.tools import FunctionTool


def create_publisher(chat_history: List[ChatMessage]):
    document_generator_tool = FunctionTool.from_defaults(
        DocumentGenerator.generate_document
    )

    return FunctionCallingAgent(
        name="publisher",
        tools=[document_generator_tool],
        description="expert in publishing, need to specify the type of document use a file (pdf, html) or just reply the content directly",
        system_prompt="""You are a publisher that help publish the blog post. 
        For a normal request, you should choose the type of document either pdf or html or just reply to the user directly without generating any document file.
        """,
        chat_history=chat_history,
        verbose=True,
    )
