from textwrap import dedent
from typing import AsyncGenerator, List, Optional

from app.agents.single import AgentRunEvent, AgentRunResult, FunctionCallingAgent
from app.examples.publisher import create_publisher
from app.examples.researcher import create_researcher
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.prompts import PromptTemplate
from llama_index.core.settings import Settings
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)


def create_workflow(chat_history: Optional[List[ChatMessage]] = None, **kwargs):
    researcher = create_researcher(
        chat_history=chat_history,
        **kwargs,
    )
    publisher = create_publisher(
        chat_history=chat_history,
    )
    writer = FunctionCallingAgent(
        name="writer",
        description="expert in writing blog posts, need information and images to write a post.",
        system_prompt=dedent(
            """
            You are an expert in writing blog posts.
            You are given the task of writing a blog post based on research content provided by the researcher agent. Do not invent any information yourself. 
            It's important to read the entire conversation history to write the blog post accurately.
            If you receive a review from the reviewer, update the post according to the feedback and return the new post content.
            If the content is not valid (e.g., broken link, broken image, etc.), do not use it.
            It's normal for the task to include some ambiguity, so you must define the user's initial request to write the post correctly.
            If you update the post based on the reviewer's feedback, first explain what changes you made to the post, then provide the new post content. Do not include the reviewer's comments.
            Example:
                Task: "Here is the information I found about the history of the internet: 
                Create a blog post about the history of the internet, write in English, and publish in PDF format."
                -> Your task: Use the research content {...} to write a blog post in English.
                -> This is not your task: Create a PDF
                Please note that a localhost link is acceptable, but dummy links like "example.com" or "your-website.com" are not valid.
        """
        ),
        chat_history=chat_history,
    )
    reviewer = FunctionCallingAgent(
        name="reviewer",
        description="expert in reviewing blog posts, needs a written blog post to review.",
        system_prompt=dedent(
            """
            You are an expert in reviewing blog posts.
            You are given a task to review a blog post. As a reviewer, it's important that your review aligns with the user's request. Please focus on the user's request when reviewing the post.
            Review the post for logical inconsistencies, ask critical questions, and provide suggestions for improvement.
            Furthermore, proofread the post for grammar and spelling errors.
            Only if the post is good enough for publishing should you return 'The post is good.' In all other cases, return your review.
            It's normal for the task to include some ambiguity, so you must define the user's initial request to review the post correctly.
            Please note that a localhost link is acceptable, but dummy links like "example.com" or "your-website.com" are not valid.
            Example:
                Task: "Create a blog post about the history of the internet, write in English and publish in PDF format."
                -> Your task: Review whether the main content of the post is about the history of the internet and if it is written in English.
                -> This is not your task: Create blog post, create PDF, write in English.
        """
        ),
        chat_history=chat_history,
    )
    workflow = BlogPostWorkflow(
        timeout=360, chat_history=chat_history
    )  # Pass chat_history here
    workflow.add_workflows(
        researcher=researcher,
        writer=writer,
        reviewer=reviewer,
        publisher=publisher,
    )
    return workflow


class ResearchEvent(Event):
    input: str


class WriteEvent(Event):
    input: str
    is_good: bool = False


class ReviewEvent(Event):
    input: str


class PublishEvent(Event):
    input: str


class BlogPostWorkflow(Workflow):
    def __init__(
        self, timeout: int = 360, chat_history: Optional[List[ChatMessage]] = None
    ):
        super().__init__(timeout=timeout)
        self.chat_history = chat_history or []

    @step()
    async def start(self, ctx: Context, ev: StartEvent) -> ResearchEvent | PublishEvent:
        # set streaming
        ctx.data["streaming"] = getattr(ev, "streaming", False)
        # start the workflow with researching about a topic
        ctx.data["task"] = ev.input
        ctx.data["user_input"] = ev.input

        # Decision-making process
        decision = await self._decide_workflow(ev.input, self.chat_history)

        if decision != "publish":
            return ResearchEvent(input=f"Research for this task: {ev.input}")
        else:
            chat_history_str = "\n".join(
                [f"{msg.role}: {msg.content}" for msg in self.chat_history]
            )
            return PublishEvent(
                input=f"Please publish content based on the chat history\n{chat_history_str}\n\n and task: {ev.input}"
            )

    async def _decide_workflow(
        self, input: str, chat_history: List[ChatMessage]
    ) -> str:
        prompt_template = PromptTemplate(
            dedent(
                """
                You are an expert in decision-making, helping people write and publish blog posts.
                If the user is asking for a file or to publish content, respond with 'publish'.
                If the user requests to write or update a blog post, respond with 'not_publish'.

                Here is the chat history:
                {chat_history}

                The current user request is:
                {input}

                Given the chat history and the new user request, decide whether to publish based on existing information.
                Decision (respond with either 'not_publish' or 'publish'):
            """
            )
        )

        chat_history_str = "\n".join(
            [f"{msg.role}: {msg.content}" for msg in chat_history]
        )
        prompt = prompt_template.format(chat_history=chat_history_str, input=input)

        output = await Settings.llm.acomplete(prompt)
        decision = output.text.strip().lower()

        return "publish" if decision == "publish" else "research"

    @step()
    async def research(
        self, ctx: Context, ev: ResearchEvent, researcher: FunctionCallingAgent
    ) -> WriteEvent:
        result: AgentRunResult = await self.run_agent(ctx, researcher, ev.input)
        content = result.response.message.content
        return WriteEvent(
            input=f"Write a blog post given this task: {ctx.data['task']} using this research content: {content}"
        )

    @step()
    async def write(
        self, ctx: Context, ev: WriteEvent, writer: FunctionCallingAgent
    ) -> ReviewEvent | StopEvent:
        MAX_ATTEMPTS = 2
        ctx.data["attempts"] = ctx.data.get("attempts", 0) + 1
        too_many_attempts = ctx.data["attempts"] > MAX_ATTEMPTS
        if too_many_attempts:
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name=writer.name,
                    msg=f"Too many attempts ({MAX_ATTEMPTS}) to write the blog post. Proceeding with the current version.",
                )
            )
        if ev.is_good or too_many_attempts:
            # too many attempts or the blog post is good - stream final response if requested
            result = await self.run_agent(
                ctx,
                writer,
                f"Based on the reviewer's feedback, refine the post and return only the final version of the post. Here's the current version: {ev.input}",
                streaming=ctx.data["streaming"],
            )
            return StopEvent(result=result)
        result: AgentRunResult = await self.run_agent(ctx, writer, ev.input)
        ctx.data["result"] = result
        return ReviewEvent(input=result.response.message.content)

    @step()
    async def review(
        self, ctx: Context, ev: ReviewEvent, reviewer: FunctionCallingAgent
    ) -> WriteEvent:
        result: AgentRunResult = await self.run_agent(ctx, reviewer, ev.input)
        review = result.response.message.content
        old_content = ctx.data["result"].response.message.content
        post_is_good = "post is good" in review.lower()
        ctx.write_event_to_stream(
            AgentRunEvent(
                name=reviewer.name,
                msg=f"The post is {'not ' if not post_is_good else ''}good enough for publishing. Sending back to the writer{' for publication.' if post_is_good else '.'}",
            )
        )
        if post_is_good:
            return WriteEvent(
                input=f"You're blog post is ready for publication. Please respond with just the blog post. Blog post: ```{old_content}```",
                is_good=True,
            )
        else:
            return WriteEvent(
                input=dedent(
                    f"""
                    Improve the writing of a given blog post by using a given review.
                    Blog post:
                    ```
                    {old_content}
                    ``` 

                    Review: 
                    ```
                    {review}
                    ```
                    """
                ),
            )

    @step()
    async def publish(
        self,
        ctx: Context,
        ev: PublishEvent,
        publisher: FunctionCallingAgent,
    ) -> StopEvent:
        try:
            result: AgentRunResult = await self.run_agent(ctx, publisher, ev.input)
            return StopEvent(result=result)
        except Exception as e:
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name=publisher.name,
                    msg=f"Error publishing: {e}",
                )
            )
            return StopEvent(result=None)

    async def run_agent(
        self,
        ctx: Context,
        agent: FunctionCallingAgent,
        input: str,
        streaming: bool = False,
    ) -> AgentRunResult | AsyncGenerator:
        handler = agent.run(input=input, streaming=streaming)
        # bubble all events while running the executor to the planner
        async for event in handler.stream_events():
            # Don't write the StopEvent from sub task to the stream
            if type(event) is not StopEvent:
                ctx.write_event_to_stream(event)
        return await handler
