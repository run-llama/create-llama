import re
import time
from typing import Any, Literal, Optional

from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.llms import LLM
from llama_index.llms.openai import OpenAI
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
    ArtifactEvent,
    ArtifactType,
    ChatRequest,
    DocumentArtifactData,
    UIEvent,
)
from llama_index.server.api.utils import get_last_artifact
from pydantic import BaseModel, Field


def create_workflow(chat_request: ChatRequest) -> Workflow:
    workflow = DocumentArtifactWorkflow(
        llm=OpenAI(model="gpt-4.1"),
        chat_request=chat_request,
        timeout=120.0,
    )
    return workflow


class DocumentRequirement(BaseModel):
    type: Literal["markdown", "html"]
    title: str
    requirement: str


class PlanEvent(Event):
    user_msg: str
    context: Optional[str] = None


class GenerateArtifactEvent(Event):
    requirement: DocumentRequirement


class SynthesizeAnswerEvent(Event):
    requirement: DocumentRequirement
    generated_artifact: str


class UIEventData(BaseModel):
    """
    Event data for updating workflow status to the UI.
    """

    state: Literal["plan", "generate", "completed"] = Field(
        description="The current state of the workflow. "
        "plan: analyze and create a plan for the next step. "
        "generate: generate the artifact based on the requirement from the previous step. "
        "completed: the workflow is completed. "
    )
    requirement: Optional[str] = Field(
        description="The requirement for generating the artifact. ",
        default=None,
    )


class DocumentArtifactWorkflow(Workflow):
    """
    A workflow to help generate or update document artifacts (e.g., Markdown or HTML documents).
    Example use cases: Generate a project guideline, update documentation with user feedback, etc.
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
        self.last_artifact = get_last_artifact(chat_request)

    @step
    async def prepare_chat_history(self, ctx: Context, ev: StartEvent) -> PlanEvent:
        user_msg = ev.user_msg
        if user_msg is None:
            raise ValueError("user_msg is required to run the workflow")
        await ctx.set("user_msg", user_msg)
        chat_history = ev.chat_history or []
        chat_history.append(
            ChatMessage(
                role="user",
                content=user_msg,
            )
        )
        memory = ChatMemoryBuffer.from_defaults(
            chat_history=chat_history,
            llm=self.llm,
        )
        await ctx.set("memory", memory)
        return PlanEvent(
            user_msg=user_msg,
            context=str(self.last_artifact.model_dump_json())
            if self.last_artifact
            else "",
        )

    @step
    async def planning(self, ctx: Context, event: PlanEvent) -> GenerateArtifactEvent:
        """
        Based on the conversation history and the user's request,
        this step will provide a clear requirement for the next document generation or update.
        """
        ctx.write_event_to_stream(
            UIEvent(
                type="ui_event",
                data=UIEventData(
                    state="plan",
                    requirement=None,
                ),
            )
        )
        prompt = PromptTemplate("""
         You are a documentation analyst responsible for analyzing the user's request and providing requirements for document generation or update.
         Follow these instructions:
         1. Carefully analyze the conversation history and the user's request to determine what has been done and what the next step should be.
         2. From the user's request, provide requirements for the next step of the document generation or update.
         3. Do not be verbose; only return the requirements for the next step of the document generation or update.
         4. Only the following document types are allowed: "markdown", "html".
         5. The requirement should be in the following format:
            ```json
            {
                "type": "markdown" | "html",
                "title": string,
                "requirement": string
            }
            ```

         ## Example:
         User request: Create a project guideline document.
         You should return:
         ```json
         {
             "type": "markdown",
             "title": "Project Guideline",
             "requirement": "Generate a Markdown document that outlines the project goals, deliverables, and timeline. Include sections for introduction, objectives, deliverables, and timeline."
         }
         ```

         User request: Add a troubleshooting section to the guideline.
         You should return:
         ```json
         {
             "type": "markdown",
             "title": "Project Guideline",
             "requirement": "Add a 'Troubleshooting' section at the end of the document with common issues and solutions."
         }
         ```

         {context}

         Now, please plan for the user's request:
         {user_msg}
        """).format(
            context=""
            if event.context is None
            else f"## The context is: \n{event.context}\n",
            user_msg=event.user_msg,
        )
        response = await self.llm.acomplete(
            prompt=prompt,
            formatted=True,
        )
        # parse the response to DocumentRequirement
        json_block = re.search(r"```json([\s\S]*)```", response.text)
        if json_block is None:
            raise ValueError("No json block found in the response")
        requirement = DocumentRequirement.model_validate_json(
            json_block.group(1).strip()
        )

        # Put the planning result to the memory
        memory: ChatMemoryBuffer = await ctx.get("memory")
        memory.put(
            ChatMessage(
                role="assistant",
                content=f"Planning for the document generation: \n{response.text}",
            )
        )
        await ctx.set("memory", memory)
        ctx.write_event_to_stream(
            UIEvent(
                type="ui_event",
                data=UIEventData(
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
        Generate or update the document based on the user's request.
        """
        ctx.write_event_to_stream(
            UIEvent(
                type="ui_event",
                data=UIEventData(
                    state="generate",
                    requirement=event.requirement.requirement,
                ),
            )
        )
        prompt = PromptTemplate("""
         You are a skilled technical writer who can help users with documentation.
         You are given a task to generate or update a document for a given requirement.

         ## Follow these instructions:
         **1. Carefully read the user's requirements.**
            If any details are ambiguous or missing, make reasonable assumptions and clearly reflect those in your output.
            If the previous document is provided:
            + Carefully analyze the document with the request to make the right changes.
            + Avoid making unnecessary changes from the previous document if the request is not to rewrite it from scratch.
         **2. For document requests:**
            - If the user does not specify a type, default to Markdown.
            - Ensure the document is clear, well-structured, and grammatically correct.
            - Only generate content relevant to the user's request—do not add extra boilerplate.
         **3. Do not be verbose in your response.**
            - No other text or comments; only return the document content wrapped by the appropriate code block (```markdown or ```html).
            - If the user's request is to update the document, only return the updated document.
         **4. Only the following types are allowed: "markdown", "html".**
         **5. If there is no change to the document, return the reason without any code block.**

         ## Example:
         ```markdown
         # Project Guideline
         
         ## Introduction
         ...
         ```

         The previous content is:
         {previous_artifact}

         Now, please generate the document for the following requirement:
         {requirement}
         """).format(
            previous_artifact=self.last_artifact.model_dump_json()
            if self.last_artifact
            else "",
            requirement=event.requirement,
        )
        response = await self.llm.acomplete(
            prompt=prompt,
            formatted=True,
        )
        # Extract the document from the response
        language_pattern = r"```(markdown|html)([\s\S]*)```"
        doc_match = re.search(language_pattern, response.text)
        if doc_match is None:
            return SynthesizeAnswerEvent(
                requirement=event.requirement,
                generated_artifact="There is no change to the document. "
                + response.text.strip(),
            )
        content = doc_match.group(2).strip()
        doc_type = doc_match.group(1)
        # Put the generated document to the memory
        memory: ChatMemoryBuffer = await ctx.get("memory")
        memory.put(
            ChatMessage(
                role="assistant",
                content=f"Generated document: \n{response.text}",
            )
        )
        # To show the Canvas panel for the artifact
        ctx.write_event_to_stream(
            ArtifactEvent(
                data=Artifact(
                    type=ArtifactType.DOCUMENT,
                    created_at=int(time.time()),
                    data=DocumentArtifactData(
                        title=event.requirement.title,
                        content=content,
                        type=doc_type,  # type: ignore
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
        Synthesize the answer for the user.
        """
        memory: ChatMemoryBuffer = await ctx.get("memory")
        chat_history = memory.get()
        chat_history.append(
            ChatMessage(
                role="system",
                content="""
                Your responsibility is to explain the work to the user.
                If there is no document to update, explain the reason.
                If the document is updated, just summarize what changed. Don't need to include the whole document again in the response.
                """,
            )
        )
        response_stream = await self.llm.astream_chat(
            messages=chat_history,
        )
        ctx.write_event_to_stream(
            UIEvent(
                type="ui_event",
                data=UIEventData(
                    state="completed",
                    requirement=event.requirement.requirement,
                ),
            )
        )
        return StopEvent(result=response_stream)
