from typing import List

from app.agents.single import FunctionCallingAgent
from app.tools.artifact import ArtifactGenerator
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.tools import FunctionTool


def create_publisher(chat_history: List[ChatMessage]):
    artifact_tool = FunctionTool.from_defaults(ArtifactGenerator.generate_artifact)

    return FunctionCallingAgent(
        name="publisher",
        tools=[artifact_tool],
        description="expert in publishing, need to specify the type of artifact use a file (pdf, html) or just reply the content directly",
        system_prompt="""You are a publisher that help publish the blog post. 
        For a normal request, you should choose the type of artifact either pdf or html or just reply to the user directly without generating any artifact file.
        """,
        chat_history=chat_history,
        verbose=True,
    )
