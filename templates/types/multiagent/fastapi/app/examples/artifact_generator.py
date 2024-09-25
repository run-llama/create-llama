from typing import List

from app.agents.single import FunctionCallingAgent
from app.tools.artifact import ArtifactGenerator
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.tools import FunctionTool


def create_artifact_generator(chat_history: List[ChatMessage]):
    artifact_tool = FunctionTool.from_defaults(ArtifactGenerator.generate_artifact)

    return FunctionCallingAgent(
        name="ArtifactGenerator",
        tools=[artifact_tool],
        role="expert in generating artifacts (pdf, html)",
        system_prompt="You are generator that help generate artifacts (pdf, html) from a given content. Please always respond the content again along with the generated artifact.",
        chat_history=chat_history,
        verbose=True,
    )
