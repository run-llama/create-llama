from typing import AsyncGenerator, List, Optional

from app.agents.single import AgentRunEvent, AgentRunResult, FunctionCallingAgent
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
    writer = FunctionCallingAgent(
        name="writer",
        role="expert in writing blog posts",
        system_prompt="""You are an expert in writing blog posts. You are given a task to write a blog post. Don't make up any information yourself.""",
        chat_history=chat_history,
    )
    reviewer = FunctionCallingAgent(
        name="reviewer",
        role="expert in reviewing blog posts",
        system_prompt="You are an expert in reviewing blog posts. You are given a task to review a blog post. Review the post for logical inconsistencies, ask critical questions, and provide suggestions for improvement. Furthermore, proofread the post for grammar and spelling errors. Only if the post is good enough for publishing, then you MUST return 'The post is good.'. In all other cases return your review.",
        chat_history=chat_history,
    )
    workflow = BlogPostWorkflow(timeout=360)
    workflow.add_workflows(researcher=researcher, writer=writer, reviewer=reviewer)
    return workflow


class ResearchEvent(Event):
    input: str


class WriteEvent(Event):
    input: str
    is_good: bool = False


class ReviewEvent(Event):
    input: str


class BlogPostWorkflow(Workflow):
    @step()
    async def start(self, ctx: Context, ev: StartEvent) -> ResearchEvent:
        # set streaming
        ctx.data["streaming"] = getattr(ev, "streaming", False)
        # start the workflow with researching about a topic
        ctx.data["task"] = ev.input
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
                ctx, writer, ev.input, streaming=ctx.data["streaming"]
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
            ctx.write_event_to_stream(event)
        return await handler
