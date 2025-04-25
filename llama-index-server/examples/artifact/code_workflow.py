import re
import time
from typing import Any, Literal, Optional

from pydantic import BaseModel

from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.llms import LLM
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.prompts import PromptTemplate
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)
from llama_index.server.api.models import (
    Artifact,
    ArtifactType,
    ChatRequest,
    CodeArtifactData,
    UIEvent,
)
from llama_index.server.api.utils import get_last_artifact


class Requirement(BaseModel):
    language: str
    file_name: str
    requirement: str


class PlanEvent(Event):
    user_msg: str
    context: Optional[str] = None


class GenerateArtifactEvent(Event):
    requirement: Requirement


class SynthesizeAnswerEvent(Event):
    requirement: Requirement
    generated_artifact: str


class ArtifactUIEvents(BaseModel):
    state: Literal["plan", "generate", "completed"]
    requirement: Optional[str]


class ArtifactWorkflow(Workflow):
    """
    A simple workflow that help generate/update the chat artifact (code, document)
    e.g: Help create a NextJS app.
         Update the generated code with the user's feedback.
         Generate a guideline for the app,...
    """

    def __init__(
        self,
        llm: LLM,
        chat_request: ChatRequest,
        **kwargs: Any,
    ):
        """
        Args:
            llm: The LLM to use.
            chat_request: The chat request from the chat app to use.
        """
        super().__init__(**kwargs)
        self.llm = llm
        self.chat_request = chat_request

    @step
    async def prepare_chat_history(self, ctx: Context, ev: StartEvent) -> PlanEvent:
        user_msg = ev.user_msg
        if user_msg is None:
            raise ValueError("user_msg is required to run the workflow")
        chat_history = ev.chat_history or []
        # Get last artifact from chat_request
        last_artifact = get_last_artifact(self.chat_request)
        if last_artifact:
            chat_history.append(
                ChatMessage(
                    role="user",
                    content="Here is the current artifact: \n"
                    + last_artifact.model_dump_json(),
                )
            )
        memory = ChatMemoryBuffer.from_defaults(
            chat_history=chat_history,
            llm=self.llm,
        )
        await ctx.set("memory", memory)
        return PlanEvent(
            user_msg=user_msg,
            context=str(last_artifact.data) if last_artifact else None,
        )

    @step
    async def planning(self, ctx: Context, event: PlanEvent) -> GenerateArtifactEvent:
        """
        Based on the conversation history and the user's request
        this step will help to provide a good next step for the code/document generation.
        """
        ctx.write_event_to_stream(
            UIEvent(
                type="artifact_status",
                data=ArtifactUIEvents(
                    state="plan",
                    requirement=None,
                ),
            )
        )
        prompt = PromptTemplate("""
         You are a product analyst who takes responsibility for analyzing the user request and provide requirements for code/document generation.
         Follow these instructions:
         1. Carefully analyze the conversation history and the user's request to see what has been done and what is the next step.
         2. From the user's request, provide requirements for the next step of the code/document generation.
         3. Don't be verbose, only return the requirements for the next step of the code/document generation.
         4. Only the following languages are allowed: "typescript", "python".
         5. Request should be in the format of:
            ```json
            {
                "language": string,
                "file_name": string,
                "requirement": string
            }
            ```

         ## Example:
         User request: Create a calculator app.
         You should return:
         ```json
         {
             "language": "typescript",
             "file_name": "calculator.tsx",
             "requirement": "Generate code for a calculator app that: Has a simple UI with a display and button layout. The display will show the current input and the result. The button should have basic operators, number, clear, and equals. The calculation should work correctly."
         }
         ```

         User request: Add light/dark mode toggle to the calculator app.
         You should return:
         ```json
         {
             "language": "typescript",
             "file_name": "calculator.tsx",
             "requirement": "On top of the existing code, add a light/dark mode toggle at the top right corner of the calculator app. Handle the state of the toggle in the component."
         }
         ```

         {context}

         Now, i have to planning for the user's request: 
         {user_msg}
        """).format(
            context=""
            if event.context is None
            else f"## The context are: \n{event.context}\n",
            user_msg=event.user_msg,
        )
        response = await self.llm.acomplete(
            prompt=prompt,
            formatted=True,
        )
        # parse the response to Requirement
        # 1. use regex to find the json block
        json_block = re.search(r"```json([\s\S]*)```", response.text)
        if json_block is None:
            raise ValueError("No json block found in the response")
        # 2. parse the json block to Requirement
        requirement = Requirement.model_validate_json(json_block.group(1).strip())

        # Put the planning result to the memory
        memory: ChatMemoryBuffer = await ctx.get("memory")
        memory.put(
            ChatMessage(
                role="assistant",
                content=f"Planning for the code generation: \n{response.text}",
            )
        )
        ctx.write_event_to_stream(
            UIEvent(
                type="artifact_status",
                data=ArtifactUIEvents(
                    state="generate",
                    requirement=requirement.requirement,
                ),
            )
        )
        return GenerateArtifactEvent(
            requirement=requirement,
        )

    @step
    async def generate_artifact(
        self, ctx: Context, event: GenerateArtifactEvent
    ) -> SynthesizeAnswerEvent:
        """
        Generate the code based on the user's request.
        """
        ctx.write_event_to_stream(
            UIEvent(
                type="artifact_status",
                data=ArtifactUIEvents(
                    state="generate",
                    requirement=event.requirement.requirement,
                ),
            )
        )
        prompt = PromptTemplate("""
         You are a skilled developer who can help user with coding.
         You are given a task to generate or update a code for a given requirement.

         ## Follow these instructions:
         **1. Carefully read the user's requirements.** 
            If any details are ambiguous or missing, make reasonable assumptions and clearly reflect those in your output.
            If the previous code is provided:
            + Carefully analyze the code with the request to make the right changes.
            + Avoid making a lot of changes from the previous code if the request is not to write the code from scratch again.
         **2. For code requests:**
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
         **3. Don't be verbose on response**
            - No other text or comments only return the code which wrapped by ```language``` block.
            - If the user's request is to update the code, only return the updated code.
         **4. Only the following languages are allowed: "typescript", "python".**
         **5. If there is no code to update, return the reason without any code block.**
            
         ## Example:
         ```typescript
         import React from "react";
         import { Button } from "@/components/ui/button";
         import { cn } from "@/lib/utils";

         export default function MyComponent() {
         return (
            <div className="flex flex-col items-center justify-center h-screen">
               <Button>Click me</Button>
            </div>
         );
         }

         The previous code is:
         {previous_artifact}

         Now, i have to generate the code for the following requirement:
         {requirement}
         ```
        """).format(
            previous_artifact=get_last_artifact(self.chat_request),
            requirement=event.requirement,
        )
        response = await self.llm.acomplete(
            prompt=prompt,
            formatted=True,
        )
        # Extract the code from the response
        language_pattern = r"```(\w+)([\s\S]*)```"
        code_match = re.search(language_pattern, response.text)
        if code_match is None:
            return SynthesizeAnswerEvent(
                requirement=event.requirement,
                generated_artifact="There is no code to update. "
                + response.text.strip(),
            )
        else:
            code = code_match.group(2).strip()
        # Put the generated code to the memory
        memory: ChatMemoryBuffer = await ctx.get("memory")
        memory.put(
            ChatMessage(
                role="assistant",
                content=f"Generated code: \n{response.text}",
            )
        )
        ctx.write_event_to_stream(
            UIEvent(
                type="artifact",
                data=Artifact(
                    type=ArtifactType.CODE,
                    created_at=int(time.time()),
                    data=CodeArtifactData(
                        language=event.requirement.language,
                        file_name=event.requirement.file_name,
                        code=code,
                    ),
                ),
            )
        )
        return SynthesizeAnswerEvent(
            requirement=event.requirement,
            generated_artifact=response.text,
        )

    @step
    async def synthesize_answer(
        self, ctx: Context, event: SynthesizeAnswerEvent
    ) -> StopEvent:
        """
        Synthesize the answer.
        """
        memory: ChatMemoryBuffer = await ctx.get("memory")
        chat_history = memory.get()
        chat_history.append(
            ChatMessage(
                role="system",
                content="""
                Your responsibility is to explain the work to the user.
                If there is no code to update, explain the reason.
                If the code is updated, just summarize what changed. Don't need to include the whole code again in the response.
                """,
            )
        )
        response_stream = await self.llm.astream_chat(
            messages=chat_history,
        )
        ctx.write_event_to_stream(
            UIEvent(
                type="artifact_status",
                data=ArtifactUIEvents(
                    state="completed",
                    requirement=event.requirement.requirement,
                ),
            )
        )
        return StopEvent(result=response_stream)
