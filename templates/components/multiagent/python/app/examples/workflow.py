from typing import AsyncGenerator, List, Optional

from app.agents.single import AgentRunEvent, AgentRunResult, FunctionCallingAgent
from app.examples.publisher import create_publisher
from app.examples.researcher import create_researcher
from llama_index.core.chat_engine.types import ChatMessage
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)


def create_workflow(chat_history: Optional[List[ChatMessage]] = None):
    researcher = create_researcher(
        chat_history=chat_history,
    )
    publisher = create_publisher(
        chat_history=chat_history,
    )
    writer = FunctionCallingAgent(
        name="writer",
        description="expert in writing blog posts, need information and images to write a post.",
        system_prompt="""You are an expert in writing blog posts. 
You are given a task to write a blog post. Don't make up any information yourself. 
It's normal that the task include some ambiguity, so you must be define what is the starter request of the user to write the post correctly.
Example:
Task: "Here is the information i found about the history of internet: 
Create a blog post about the history of the internet, write in English and publish in PDF format."
-> Your task: Use the research content {...}  to write a blog post in English.
-> This is not your task: Create PDF
""",
        chat_history=chat_history,
    )
    reviewer = FunctionCallingAgent(
        name="reviewer",
        description="expert in reviewing blog posts, needs a written blog post to review.",
        system_prompt="""You are an expert in reviewing blog posts. 
You are given a task to review a blog post. 
Review the post for logical inconsistencies, ask critical questions, and provide suggestions for improvement. 
Furthermore, proofread the post for grammar and spelling errors. 
Only if the post is good enough for publishing, then you MUST return 'The post is good.'. In all other cases return your review.
It's normal that the task include some ambiguity, so you must be define what is the starter request of the user to review the post correctly.
Example:
Task: "Create a blog post about the history of the internet, write in English and publish in PDF format."
-> Your task: Review is the main content of the post is about the history of the internet, is it written in English.
-> This is not your task: Create blog post, create PDF, write in English.
""",
        chat_history=chat_history,
    )
    workflow = BlogPostWorkflow(timeout=360)
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
    @step()
    async def start(self, ctx: Context, ev: StartEvent) -> ResearchEvent:
        # set streaming
        ctx.data["streaming"] = getattr(ev, "streaming", False)
        # start the workflow with researching about a topic
        ctx.data["task"] = ev.input
        ctx.data["user_input"] = ev.input
        return ResearchEvent(input=f"Research for this task: {ev.input}")

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
    ) -> ReviewEvent | PublishEvent:
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
            return PublishEvent(
                input=f"Please publish this content: ```{ev.input}```. The user request was: ```{ctx.data['user_input']}```",
            )
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
                input=f"""Improve the writing of a given blog post by using a given review.
Blog post:
```
{old_content}
``` 

Review: 
```
{review}
```"""
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
