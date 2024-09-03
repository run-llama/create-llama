import asyncio
from typing import List


from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)
from llama_index.core.chat_engine.types import ChatMessage
from app.agents.single import AgentRunEvent, AgentRunResult, FunctionCallingAgent
from app.examples.researcher import create_researcher


def create_workflow(chat_history: List[ChatMessage]):
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


class ReviewEvent(Event):
    input: str


class BlogPostWorkflow(Workflow):
    @step()
    async def start(self, ctx: Context, ev: StartEvent) -> ResearchEvent:
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
    ) -> ReviewEvent:
        result: AgentRunResult = await self.run_agent(ctx, writer, ev.input)
        ctx.data["result"] = result
        return ReviewEvent(input=result.response.message.content)

    @step()
    async def review(
        self, ctx: Context, ev: ReviewEvent, reviewer: FunctionCallingAgent
    ) -> WriteEvent | StopEvent:
        result: AgentRunResult = await self.run_agent(ctx, reviewer, ev.input)
        ctx.data["reviews"] = ctx.data.get("reviews", 0) + 1
        review = result.response.message.content
        if "post is good" in review.lower() or ctx.data["reviews"] > 3:
            # blog post is good enough for the review, or we did already three reviews:
            # we can stop the workflow
            return StopEvent(result=ctx.data["result"])
        else:
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name=reviewer.name,
                    msg="The post is not good enough for publishing. Sending back to the writer",
                )
            )
            old_content = ctx.data["result"].response.message.content
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
        self, ctx: Context, agent: FunctionCallingAgent, input: str
    ) -> AgentRunResult:
        task = asyncio.create_task(agent.run(input=input))
        # bubble all events while running the executor to the planner
        async for event in agent.stream_events():
            ctx.write_event_to_stream(event)
        ret: AgentRunResult = await task
        return ret
