import json
import logging
from typing import Any, Dict, List, Optional

from llama_index.core.llms import LLM
from llama_index.core.llms.llm import ChatMessage, MessageRole
from llama_index.core.settings import Settings
from llama_index.core.tools.function_tool import FunctionTool
from llama_index.server.api.models import Artifact

logger = logging.getLogger(__name__)

CODE_GENERATION_PROMPT = """
You are a highly skilled content creator and software engineer. Your task is to generate either a code artifact or a document artifact based on the user's request.

Follow these instructions exactly:

1. Carefully read the user's requirements. If any details are ambiguous or missing, make reasonable assumptions and clearly reflect those in your output.
2. For code requests:
   - If the user does not specify a framework or language, default to a React component using the Next.js framework.
   - For Next.js, use Shadcn UI components, Typescript, @types/node, @types/react, @types/react-dom, PostCSS, and TailwindCSS.
   - Ensure the code is idiomatic, production-ready, and includes necessary imports.
   - Only generate code relevant to the user's request—do not add extra boilerplate.
3. For document requests:
   - Always generate Markdown (.md) documents.
   - Use clear structure: headings, subheadings, lists, and tables for comparisons.
   - Ensure content is concise, well-organized, and directly addresses the user's needs.
4. Return ONLY valid, parseable JSON in one of the following formats. Do not include any explanations, markdown formatting, or code blocks around the JSON.

For CODE:
{
  "type": "code",
  "data": {
    "file_name": "filename.ext",
    "code": "your code here", // Don't forget to escape double quotes and newlines to not break the JSON
    "language": "programming language"
  }
}

For DOCUMENT (markdown only):
{
  "type": "document",
  "data": {
    "title": "Document Title",
    "content": "Markdown content here",
    "type": "markdown"
  }
}

5. Your entire response must be valid JSON matching one of these formats exactly. Do not include any explanations, markdown formatting, or code blocks around the JSON.

---

EXAMPLES

Example (code):
{
  "type": "code",
  "data": {
    "file_name": "MyComponent.tsx",
    "code": "import React from 'react';\nexport default function MyComponent() { return <div>Hello World</div>; }",
    "language": "typescript"
  }
}

Example (document):
{
  "type": "document",
  "data": {
    "title": "Quick Start Guide",
    "content": "# Quick Start\n\nFollow these steps to begin...",
    "type": "markdown"
  }
}
"""


# TODO: Split this into two tools: one for code and one for markdown
class ArtifactGenerator:
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

    async def generate_artifact(
        self,
        requirement: str,
        artifact_type: str = "code",
    ) -> Dict[str, Dict[str, Any]]:
        """
        Generate an artifact based on the provided requirement.

        Args:
            requirement (str): The description of the artifact to build.
            artifact_type (str): The type of artifact to generate. Defaults to "code".
            old_content (Optional[str]): Existing artifact content to be modified or referenced. Defaults to None.

        Returns:
            Dict[str, Any]: A dictionary containing the generated artifact details
                           (type, data).
        """
        user_message_content = f"Generate an {artifact_type} artifact: {requirement}"
        if self.last_artifact:
            user_message_content += (
                f"\nThe existing content is:\n```\n{self.last_artifact.to_llm()}\n```"
            )
            print(f"User message content: {user_message_content}")

        messages: List[ChatMessage] = [
            ChatMessage(role=MessageRole.SYSTEM, content=CODE_GENERATION_PROMPT),
            ChatMessage(role=MessageRole.USER, content=user_message_content),
        ]

        try:
            response = await self.llm.achat(messages)
            content = response.message.content

            if not content:
                raise ValueError("LLM returned an empty response.")

            # Clean potential markdown code blocks or backticks
            json_content = content.strip().strip("`").strip()
            if json_content.startswith("json"):
                json_content = json_content[4:].strip()

            logger.debug(f"Raw LLM response for artifact generation: {content}")
            logger.debug(f"Cleaned JSON content: {json_content}")

            parsed_response = json.loads(json_content)

            if not isinstance(parsed_response, dict):
                raise ValueError("Parsed response is not a dictionary.")

            if parsed_response.get("type") == "code":
                code_data = parsed_response.get("data")
                if not isinstance(code_data, dict) or not all(
                    k in code_data for k in ["file_name", "code", "language"]
                ):
                    raise ValueError(
                        "Parsed code data is missing required fields (file_name, code, language)."
                    )

                return parsed_response
            elif parsed_response.get("type") == "document":
                document_data = parsed_response.get("data")
                if not isinstance(document_data, dict) or not all(
                    k in document_data for k in ["title", "content", "type"]
                ):
                    raise ValueError(
                        "Parsed document data is missing required fields (title, content, type)."
                    )

                return parsed_response
            else:
                raise ValueError(
                    f"Expected artifact type 'code' or 'document', but got '{parsed_response.get('type')}'"
                )
        except json.JSONDecodeError as e:
            logger.error(
                f"Failed to parse JSON response from LLM: {e}\nRaw content: {content}"
            )
            raise ValueError(f"Failed to parse LLM response as JSON: {e}") from e
        except Exception as e:
            logger.error(f"Failed to generate artifact: {e}", exc_info=True)
            raise

    def to_tool(self) -> FunctionTool:
        """
        Converts the CodeGenerator instance into a FunctionTool.

        Returns:
            FunctionTool: A tool that can be used by agents.
        """
        return FunctionTool.from_defaults(
            self.generate_artifact,
            name="artifact_generator",
            description="Generate an artifact (code or document) based on a requirement.",
        )
