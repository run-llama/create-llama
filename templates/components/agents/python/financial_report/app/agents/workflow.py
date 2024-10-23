from textwrap import dedent
from typing import AsyncGenerator, List, Optional

from app.agents.analyst import create_analyst
from app.agents.reporter import create_reporter
from app.agents.researcher import create_researcher
from app.workflows.single import AgentRunEvent, AgentRunResult, FunctionCallingAgent
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

    analyst = create_analyst(chat_history=chat_history)

    reporter = create_reporter(chat_history=chat_history)

    workflow = FinancialReportWorkflow(timeout=360, chat_history=chat_history)

    workflow.add_workflows(
        researcher=researcher,
        analyst=analyst,
        reporter=reporter,
    )
    return workflow


class ResearchEvent(Event):
    input: str


class AnalyzeEvent(Event):
    input: str


class ReportEvent(Event):
    input: str


class FinancialReportWorkflow(Workflow):
    def __init__(
        self, timeout: int = 360, chat_history: Optional[List[ChatMessage]] = None
    ):
        super().__init__(timeout=timeout)
        self.chat_history = chat_history or []

    @step()
    async def start(self, ctx: Context, ev: StartEvent) -> ResearchEvent | ReportEvent:
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
            return ReportEvent(
                input=f"Create a report based on the chat history\n{chat_history_str}\n\n and task: {ev.input}"
            )

    async def _decide_workflow(
        self, input: str, chat_history: List[ChatMessage]
    ) -> str:
        # TODO: Refactor this by using prompt generation
        prompt_template = PromptTemplate(
            dedent(
                """
                You are an expert in decision-making, helping people create financial reports for the provided data.
                If the user doesn't need to add or update anything, respond with 'publish'.
                Otherwise, respond with 'research'.

                Here is the chat history:
                {chat_history}

                The current user request is:
                {input}

                Given the chat history and the new user request, decide whether to create a report based on existing information.
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
    ) -> AnalyzeEvent:
        result: AgentRunResult = await self.run_agent(ctx, researcher, ev.input)
        content = result.response.message.content
        return AnalyzeEvent(
            input=dedent(
                f"""
                Given the following research content:
                {content}
                Provide a comprehensive analysis of the data for the user's request: {ctx.data["task"]}
                """
            )
        )

    @step()
    async def analyze(
        self, ctx: Context, ev: AnalyzeEvent, analyst: FunctionCallingAgent
    ) -> ReportEvent | StopEvent:
        result: AgentRunResult = await self.run_agent(ctx, analyst, ev.input)
        content = result.response.message.content
        return ReportEvent(
            input=dedent(
                f"""
                Given the following analysis:
                {content}
                Create a report for the user's request: {ctx.data["task"]}
                """
            )
        )

    @step()
    async def report(
        self, ctx: Context, ev: ReportEvent, reporter: FunctionCallingAgent
    ) -> StopEvent:
        try:
            result: AgentRunResult = await self.run_agent(
                ctx, reporter, ev.input, streaming=ctx.data["streaming"]
            )
            return StopEvent(result=result)
        except Exception as e:
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name=reporter.name,
                    msg=f"Error creating a report: {e}",
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
