import logging
import re
import time
from typing import List, Literal, Optional

from llama_index.core.llms import LLM
from llama_index.core.llms.llm import ChatMessage, MessageRole
from llama_index.core.settings import Settings
from llama_index.core.tools.function_tool import FunctionTool
from llama_index.server.api.models import Artifact, ArtifactType, DocumentArtifactData

logger = logging.getLogger(__name__)

DOCUMENT_GENERATION_PROMPT = """
You are a highly skilled writer and content creator.
Your task is to generate documents based on the user's request.

Follow these instructions exactly:

1. Carefully read the user's requirements.
   If any details are ambiguous or missing, make reasonable assumptions and clearly reflect those in your output.
   If previous content is provided, carefully analyze it with the request to make the right changes.
2. For document creation:
   - Create well-structured documents with clear headings, paragraphs, and formatting.
   - Use concise and professional language.
   - Ensure content is accurate, well-researched, and relevant to the topic.
   - Organize information logically with a proper introduction, body, and conclusion when appropriate.
   - Add citations or references when necessary.
3. For document editing:
   - Maintain the original document's structure unless requested otherwise.
   - Improve clarity, flow, and grammar while preserving the original message.
   - Remove redundancies and strengthen weak points.
4. Answer in appropriate format which wrapped by ```<format>``` block with a file name for the content, no other text or comments.
Example:
```markdown
# Title

Content
```
"""


class DocumentGenerator:
    def __init__(
        self,
        llm: Optional[LLM] = None,
        last_artifact: Optional[Artifact] = None,
    ) -> None:
        if llm is None:
            if Settings.llm is None:
                raise ValueError(
                    "Missing llm. Please provide a valid LLM or set the LLM using Settings.llm."
                )
            llm = Settings.llm
        self.llm = llm
        self.last_artifact = last_artifact

    def prepare_chat_messages(self, requirement: str) -> List[ChatMessage]:
        user_messages: List[ChatMessage] = []
        user_messages.append(ChatMessage(role=MessageRole.USER, content=requirement))
        if self.last_artifact:
            user_messages.append(
                ChatMessage(
                    role=MessageRole.USER,
                    content=f"Previous content: {self.last_artifact.data.model_dump_json()}",
                )
            )
        return user_messages

    async def generate_document(
        self,
        file_name: str,
        document_format: Literal["markdown", "html"],
        requirement: str,
    ) -> Artifact:
        """
        Generate document content based on the provided requirement.

        Args:
            file_name (str): The name of the file to generate.
            document_format (str): The format of the document to generate. (Only "markdown" and "html" are supported now)
            requirement (str): A detailed requirement for the document to be generated/updated.

        Returns:
            Artifact: The generated document.
        """
        user_messages = self.prepare_chat_messages(requirement)

        messages: List[ChatMessage] = [
            ChatMessage(role=MessageRole.SYSTEM, content=DOCUMENT_GENERATION_PROMPT),
            *user_messages,
        ]

        try:
            response = await self.llm.achat(messages)
            raw_content = response.message.content
            if not raw_content:
                raise ValueError(
                    "Empty response. Try with a clearer requirement or provide previous content."
                )
            # Extract content from the response
            content = re.search(r"```(.*?)\n(.*?)```", raw_content, re.DOTALL)
            if not content:
                raise ValueError("Couldn't parse content from the response.")
            return Artifact(
                created_at=int(time.time()),
                type=ArtifactType.DOCUMENT,
                data=DocumentArtifactData(
                    title=file_name,
                    content=content.group(2).strip(),
                    type=document_format,
                ),
            )
        except Exception as e:
            raise ValueError(f"Couldn't generate document. {e}")

    def to_tool(self) -> FunctionTool:
        """
        Converts the DocumentGenerator instance into a FunctionTool.

        Returns:
            FunctionTool: A tool that can be used by agents.
        """
        return FunctionTool.from_defaults(
            self.generate_document,
            name="artifact_document_generator",
            description="Generate/update documents based on a requirement.",
        )
