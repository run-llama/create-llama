import logging
import re
import time
from typing import List, Optional

from llama_index.core.llms import LLM
from llama_index.core.llms.llm import ChatMessage, MessageRole
from llama_index.core.settings import Settings
from llama_index.core.tools.function_tool import FunctionTool
from llama_index.server.api.models import Artifact, ArtifactType, CodeArtifactData

logger = logging.getLogger(__name__)

CODE_GENERATION_PROMPT = """
You are a highly skilled content creator and software engineer. 
Your task is to generate or update code to resolve the user's request.

Follow these instructions exactly:

1. Carefully read the user's requirements. 
   If any details are ambiguous or missing, make reasonable assumptions and clearly reflect those in your output.
   If the previous code is provided:
     + Carefully analyze the code with the request to make the right changes.
     + Avoid making a lot of changes from the previous code if the request is not to write the code from scratch again.
2. For code requests:
   - If the user does not specify a framework or language, default to a React component using the Next.js framework.
   - For Next.js, use Shadcn UI components, Typescript, @types/node, @types/react, @types/react-dom, PostCSS, and TailwindCSS.
     The import pattern should be:
     ```
     import { ComponentName } from "@/components/ui/component-name"
     import { Markdown } from "@llamaindex/chat-ui"
     import { cn } from "@/lib/utils"
     ```
   - Ensure the code is idiomatic, production-ready, and includes necessary imports.
   - Only generate code relevant to the user's request—do not add extra boilerplate.
3. Don't be verbose on response, no other text or comments only return the code which wrapped by ```language``` block.
Example:
```typescript
import React from "react";

export default function MyComponent() {
  return <div>Hello World</div>;
}
```
"""


class CodeGenerator:
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

    def prepare_chat_messages(
        self, requirement: str, language: str, previous_code: Optional[str] = None
    ) -> List[ChatMessage]:
        user_messages: List[ChatMessage] = []
        user_messages.append(ChatMessage(role=MessageRole.USER, content=requirement))
        if previous_code:
            user_messages.append(
                ChatMessage(
                    role=MessageRole.USER,
                    content=f"```{language}\n{previous_code}\n```",
                )
            )
        else:
            user_messages.append(
                ChatMessage(
                    role=MessageRole.USER,
                    content=f"Write code in {language}. Wrap the code in ```{language}``` block.",
                )
            )
        return user_messages

    async def generate_code(
        self,
        file_name: str,
        language: str,
        requirement: str,
        previous_code: Optional[str] = None,
    ) -> Artifact:
        """
        Generate code based on the provided requirement.

        Args:
            file_name (str): The name of the file to generate.
            language (str): The language of the code to generate (Only "typescript" and "python" is supported now)
            requirement (str): Provide a detailed requirement for the code to be generated/updated.
            old_content (Optional[str]): Existing code content to be modified or referenced. Defaults to None.

        Returns:
            Artifact: A dictionary containing the generated artifact details
                           (type, data).
        """
        user_messages = self.prepare_chat_messages(requirement, language, previous_code)

        messages: List[ChatMessage] = [
            ChatMessage(role=MessageRole.SYSTEM, content=CODE_GENERATION_PROMPT),
            *user_messages,
        ]

        try:
            response = await self.llm.achat(messages)
            raw_content = response.message.content
            if not raw_content:
                raise ValueError(
                    "Empty response. Try with a clearer requirement or provide previous code."
                )

            # Extract code from code block in raw content
            code_block = re.search(r"```(.*?)\n(.*?)```", raw_content, re.DOTALL)
            if not code_block:
                raise ValueError("Couldn't parse code from the response.")
            code = code_block.group(2).strip()
            return Artifact(
                created_at=int(time.time()),
                type=ArtifactType.CODE,
                data=CodeArtifactData(
                    file_name=file_name,
                    code=code,
                    language=language,
                ),
            )
        except Exception as e:
            raise ValueError(f"Couldn't generate code. {e}")

    def to_tool(self) -> FunctionTool:
        """
        Converts the CodeGenerator instance into a FunctionTool.

        Returns:
            FunctionTool: A tool that can be used by agents.
        """
        return FunctionTool.from_defaults(
            self.generate_code,
            name="artifact_code_generator",
            description="Generate/update code based on a requirement.",
        )
