import logging
import os
import uuid
from typing import Any, Dict, List, Optional

from llama_index.core.indices.base import BaseIndex
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.memory.simple_composable_memory import SimpleComposableMemory
from llama_index.core.schema import Node
from llama_index.core.types import ChatMessage, MessageRole
from llama_index.core.workflow import (
    Context,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)

from app.engine.index import IndexConfig, get_index
from app.workflows.agents import plan_research, research, write_report
from app.workflows.events import SourceNodesEvent
from app.workflows.models import (
    CollectAnswersEvent,
    DataEvent,
    PlanResearchEvent,
    ReportEvent,
    ResearchEvent,
)

logger = logging.getLogger("uvicorn")
logger.setLevel(logging.INFO)


def create_workflow(
    chat_history: Optional[List[ChatMessage]] = None,
    params: Optional[Dict[str, Any]] = None,
    **kwargs,
) -> Workflow:
    index_config = IndexConfig(**params)
    index = get_index(index_config)
    if index is None:
        raise ValueError(
            "Index is not found. Try run generation script to create the index first."
        )

    return DeepResearchWorkflow(
        index=index,
        chat_history=chat_history,
        timeout=120.0,
    )


class DeepResearchWorkflow(Workflow):
    """
    A workflow to research and analyze documents from multiple perspectives and write a comprehensive report.

    Requirements:
    - An indexed documents containing the knowledge base related to the topic

    Steps:
    1. Retrieve information from the knowledge base
    2. Analyze the retrieved information and provide questions for answering
    3. Answer the questions
    4. Write the report based on the research results
    """

    memory: SimpleComposableMemory
    context_nodes: List[Node]
    index: BaseIndex
    user_request: str
    stream: bool = True

    def __init__(
        self,
        index: BaseIndex,
        chat_history: Optional[List[ChatMessage]] = None,
        stream: bool = True,
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.index = index
        self.context_nodes = []
        self.stream = stream
        self.chat_history = chat_history
        self.memory = SimpleComposableMemory.from_defaults(
            primary_memory=ChatMemoryBuffer.from_defaults(
                chat_history=chat_history,
            ),
        )

    @step
    async def retrieve(self, ctx: Context, ev: StartEvent) -> PlanResearchEvent:
        """
        Initiate the workflow: memory, tools, agent
        """
        await ctx.set("total_questions", 0)
        self.user_request = ev.get("input")
        self.memory.put_messages(
            messages=[
                ChatMessage(
                    role=MessageRole.USER,
                    content=self.user_request,
                )
            ]
        )
        ctx.write_event_to_stream(
            DataEvent(
                type="deep_research_event",
                data={
                    "event": "retrieve",
                    "state": "inprogress",
                },
            )
        )
        retriever = self.index.as_retriever(
            similarity_top_k=int(os.getenv("TOP_K", 10)),
        )
        nodes = retriever.retrieve(self.user_request)
        self.context_nodes.extend(nodes)
        ctx.write_event_to_stream(
            DataEvent(
                type="deep_research_event",
                data={
                    "event": "retrieve",
                    "state": "done",
                },
            )
        )
        # Send source nodes to the stream
        # Use SourceNodesEvent to display source nodes in the UI.
        ctx.write_event_to_stream(
            SourceNodesEvent(
                nodes=nodes,
            )
        )
        return PlanResearchEvent()

    @step
    async def analyze(
        self, ctx: Context, ev: PlanResearchEvent
    ) -> ResearchEvent | ReportEvent | StopEvent:
        """
        Analyze the retrieved information
        """
        logger.info("Analyzing the retrieved information")
        ctx.write_event_to_stream(
            DataEvent(
                type="deep_research_event",
                data={
                    "event": "analyze",
                    "state": "inprogress",
                },
            )
        )
        total_questions = await ctx.get("total_questions")
        res = await plan_research(
            memory=self.memory,
            context_nodes=self.context_nodes,
            user_request=self.user_request,
            total_questions=total_questions,
        )
        if res.decision == "cancel":
            ctx.write_event_to_stream(
                DataEvent(
                    type="deep_research_event",
                    data={
                        "event": "analyze",
                        "state": "done",
                    },
                )
            )
            return StopEvent(
                result=res.cancel_reason,
            )
        elif res.decision == "write":
            # Writing a report without any research context is not allowed.
            # It's a LLM hallucination.
            if total_questions == 0:
                ctx.write_event_to_stream(
                    DataEvent(
                        type="deep_research_event",
                        data={
                            "event": "analyze",
                            "state": "done",
                        },
                    )
                )
                return StopEvent(
                    result="Sorry, I have a problem when analyzing the retrieved information. Please try again.",
                )

            self.memory.put(
                message=ChatMessage(
                    role=MessageRole.ASSISTANT,
                    content="No more idea to analyze. We should report the answers.",
                )
            )
            ctx.send_event(ReportEvent())
        else:
            total_questions += len(res.research_questions)
            await ctx.set("total_questions", total_questions)  # For tracking
            await ctx.set(
                "waiting_questions", len(res.research_questions)
            )  # For waiting questions to be answered
            self.memory.put(
                message=ChatMessage(
                    role=MessageRole.ASSISTANT,
                    content="We need to find answers to the following questions:\n"
                    + "\n".join(res.research_questions),
                )
            )
            for question in res.research_questions:
                question_id = str(uuid.uuid4())
                ctx.write_event_to_stream(
                    DataEvent(
                        type="deep_research_event",
                        data={
                            "event": "answer",
                            "state": "pending",
                            "id": question_id,
                            "question": question,
                            "answer": None,
                        },
                    )
                )
                ctx.send_event(
                    ResearchEvent(
                        question_id=question_id,
                        question=question,
                        context_nodes=self.context_nodes,
                    )
                )
        ctx.write_event_to_stream(
            DataEvent(
                type="deep_research_event",
                data={
                    "event": "analyze",
                    "state": "done",
                },
            )
        )
        return None

    @step(num_workers=2)
    async def answer(self, ctx: Context, ev: ResearchEvent) -> CollectAnswersEvent:
        """
        Answer the question
        """
        ctx.write_event_to_stream(
            DataEvent(
                type="deep_research_event",
                data={
                    "event": "answer",
                    "state": "inprogress",
                    "id": ev.question_id,
                    "question": ev.question,
                },
            )
        )
        try:
            answer = await research(
                context_nodes=ev.context_nodes,
                question=ev.question,
            )
        except Exception as e:
            logger.error(f"Error answering question {ev.question}: {e}")
            answer = f"Got error when answering the question: {ev.question}"
        ctx.write_event_to_stream(
            DataEvent(
                type="deep_research_event",
                data={
                    "event": "answer",
                    "state": "done",
                    "id": ev.question_id,
                    "question": ev.question,
                    "answer": answer,
                },
            )
        )

        return CollectAnswersEvent(
            question_id=ev.question_id,
            question=ev.question,
            answer=answer,
        )

    @step
    async def collect_answers(
        self, ctx: Context, ev: CollectAnswersEvent
    ) -> PlanResearchEvent:
        """
        Collect answers to all questions
        """
        num_questions = await ctx.get("waiting_questions")
        results = ctx.collect_events(
            ev,
            expected=[CollectAnswersEvent] * num_questions,
        )
        if results is None:
            return None
        for result in results:
            self.memory.put(
                message=ChatMessage(
                    role=MessageRole.ASSISTANT,
                    content=f"<Question>{result.question}</Question>\n<Answer>{result.answer}</Answer>",
                )
            )
        await ctx.set("waiting_questions", 0)
        self.memory.put(
            message=ChatMessage(
                role=MessageRole.ASSISTANT,
                content="Researched all the questions. Now, i need to analyze if it's ready to write a report or need to research more.",
            )
        )
        return PlanResearchEvent()

    @step
    async def report(self, ctx: Context, ev: ReportEvent) -> StopEvent:
        """
        Report the answers
        """
        logger.info("Writing the report")
        res = await write_report(
            memory=self.memory,
            user_request=self.user_request,
            stream=self.stream,
        )
        return StopEvent(
            result=res,
        )
