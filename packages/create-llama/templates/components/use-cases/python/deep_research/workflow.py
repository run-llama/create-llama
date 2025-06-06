import logging
import os
import uuid
from typing import List, Literal, Optional

from app.index import get_index
from llama_index.core.base.llms.types import (
    CompletionResponse,
    CompletionResponseAsyncGen,
)
from llama_index.core.indices.base import BaseIndex
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.memory.simple_composable_memory import SimpleComposableMemory
from llama_index.core.prompts import PromptTemplate
from llama_index.core.schema import MetadataMode, Node, NodeWithScore
from llama_index.core.settings import Settings
from llama_index.core.types import ChatMessage, MessageRole
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)
from llama_index.server.api.models import (
    ArtifactEvent,
    ArtifactType,
    ChatRequest,
    SourceNodesEvent,
    UIEvent,
    Artifact,
    DocumentArtifactData,
    DocumentArtifactSource,
)
import time
from llama_index.server.utils.stream import write_response_to_stream
from pydantic import BaseModel, Field

logger = logging.getLogger("uvicorn")
logger.setLevel(logging.INFO)


def create_workflow(chat_request: Optional[ChatRequest] = None) -> Workflow:
    index = get_index(chat_request=chat_request)
    if index is None:
        raise ValueError(
            "Index is not found. Try run generation script to create the index first."
        )

    return DeepResearchWorkflow(
        index=index,
        timeout=120.0,
    )


# Workflow events
class PlanResearchEvent(Event):
    pass


class ResearchEvent(Event):
    question_id: str
    question: str
    context_nodes: List[NodeWithScore]


class CollectAnswersEvent(Event):
    question_id: str
    question: str
    answer: str


class ReportEvent(Event):
    pass


# Events that are streamed to the frontend and rendered there
class UIEventData(BaseModel):
    """
    Events for DeepResearch workflow which has 3 main stages:
    - Retrieve: Retrieve information from the knowledge base.
    - Analyze: Analyze the retrieved information and provide list of questions for answering.
    - Answer: Answering the provided questions. There are multiple answer events, each with its own id that is used to display the answer for a particular question.
    """

    id: Optional[str] = Field(default=None, description="The id of the event")
    event: Literal["retrieve", "analyze", "answer"] = Field(
        default="retrieve", description="The event type"
    )
    state: Literal["pending", "inprogress", "done", "error"] = Field(
        default="pending", description="The state of the event"
    )
    question: Optional[str] = Field(
        default=None,
        description="Used by answer event to display the question",
    )
    answer: Optional[str] = Field(
        default=None,
        description="Used by answer event to display the answer of the question",
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
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.index = index
        self.context_nodes = []
        self.memory = SimpleComposableMemory.from_defaults(
            primary_memory=ChatMemoryBuffer.from_defaults(),
        )

    @step
    async def retrieve(self, ctx: Context, ev: StartEvent) -> PlanResearchEvent:
        """
        Initiate the workflow: memory, tools, agent
        """
        self.stream = ev.get("stream", True)
        self.user_request = ev.get("user_msg")
        chat_history = ev.get("chat_history")
        if chat_history is not None:
            self.memory.put_messages(chat_history)

        await ctx.set("total_questions", 0)

        # Add user message to memory
        self.memory.put_messages(
            messages=[
                ChatMessage(
                    role=MessageRole.USER,
                    content=self.user_request,
                )
            ]
        )
        ctx.write_event_to_stream(
            UIEvent(
                type="ui_event",
                data=UIEventData(
                    event="retrieve",
                    state="inprogress",
                ),
            )
        )
        retriever = self.index.as_retriever(
            similarity_top_k=int(os.getenv("TOP_K", 10)),
        )
        nodes = retriever.retrieve(self.user_request)
        self.context_nodes.extend(nodes)  # type: ignore
        ctx.write_event_to_stream(
            UIEvent(
                type="ui_event",
                data=UIEventData(
                    event="retrieve",
                    state="done",
                ),
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
            UIEvent(
                type="ui_event",
                data=UIEventData(
                    event="analyze",
                    state="inprogress",
                ),
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
                UIEvent(
                    type="ui_event",
                    data=UIEventData(
                        event="analyze",
                        state="done",
                    ),
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
                    UIEvent(
                        type="ui_event",
                        data=UIEventData(
                            event="analyze",
                            state="done",
                        ),
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
                    UIEvent(
                        type="ui_event",
                        data=UIEventData(
                            event="answer",
                            state="pending",
                            id=question_id,
                            question=question,
                            answer=None,
                        ),
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
            UIEvent(
                type="ui_event",
                data=UIEventData(
                    event="analyze",
                    state="done",
                ),
            )
        )
        return None

    @step(num_workers=2)
    async def answer(self, ctx: Context, ev: ResearchEvent) -> CollectAnswersEvent:
        """
        Answer the question
        """
        ctx.write_event_to_stream(
            UIEvent(
                type="ui_event",
                data=UIEventData(
                    event="answer",
                    state="inprogress",
                    id=ev.question_id,
                    question=ev.question,
                ),
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
            UIEvent(
                type="ui_event",
                data=UIEventData(
                    event="answer",
                    state="done",
                    id=ev.question_id,
                    question=ev.question,
                    answer=answer,
                ),
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
        res = await write_report(
            memory=self.memory,
            user_request=self.user_request,
            stream=self.stream,
        )

        final_response = await write_response_to_stream(res, ctx)

        ctx.write_event_to_stream(
            ArtifactEvent(
                data=Artifact(
                    type=ArtifactType.DOCUMENT,
                    created_at=int(time.time()),
                    data=DocumentArtifactData(
                        title="DeepResearch Report",
                        content=final_response,
                        type="markdown",
                        sources=[
                            DocumentArtifactSource(
                                id=node.id_,
                            )
                            for node in self.context_nodes
                        ],
                    ),
                ),
            )
        )

        return StopEvent(
            result="",
        )


class AnalysisDecision(BaseModel):
    decision: Literal["research", "write", "cancel"] = Field(
        description="Whether to continue research, write a report, or cancel the research after several retries"
    )
    research_questions: Optional[List[str]] = Field(
        description="""
        If the decision is to research, provide a list of questions to research that related to the user request.
        Maximum 3 questions. Set to null or empty if writing a report or cancel the research.
        """,
        default_factory=list,
    )
    cancel_reason: Optional[str] = Field(
        description="The reason for cancellation if the decision is to cancel research.",
        default=None,
    )


async def plan_research(
    memory: SimpleComposableMemory,
    context_nodes: List[Node],
    user_request: str,
    total_questions: int,
) -> AnalysisDecision:
    analyze_prompt = """
      You are a professor who is guiding a researcher to research a specific request/problem.
      Your task is to decide on a research plan for the researcher.

      The possible actions are:
      + Provide a list of questions for the researcher to investigate, with the purpose of clarifying the request.
      + Write a report if the researcher has already gathered enough research on the topic and can resolve the initial request.
      + Cancel the research if most of the answers from researchers indicate there is insufficient information to research the request. Do not attempt more than 3 research iterations or too many questions.

      The workflow should be:
      + Always begin by providing some initial questions for the researcher to investigate.
      + Analyze the provided answers against the initial topic/request. If the answers are insufficient to resolve the initial request, provide additional questions for the researcher to investigate.
      + If the answers are sufficient to resolve the initial request, instruct the researcher to write a report.

      Here are the context: 
      <Collected information>
      {context_str}
      </Collected information>

      <Conversation context>
      {conversation_context}
      </Conversation context>

      {enhanced_prompt}

      Now, provide your decision in the required format for this user request:
      <User request>
      {user_request}
      </User request>
      """
    # Manually craft the prompt to avoid LLM hallucination
    enhanced_prompt = ""
    if total_questions == 0:
        # Avoid writing a report without any research context
        enhanced_prompt = """
        
        The student has no questions to research. Let start by asking some questions.
        """
    elif total_questions > 6:
        # Avoid asking too many questions (when the data is not ready for writing a report)
        enhanced_prompt = f"""

        The student has researched {total_questions} questions. Should cancel the research if the context is not enough to write a report.
        """

    conversation_context = "\n".join(
        [f"{message.role}: {message.content}" for message in memory.get_all()]
    )
    context_str = "\n".join(
        [node.get_content(metadata_mode=MetadataMode.LLM) for node in context_nodes]
    )
    res = await Settings.llm.astructured_predict(
        output_cls=AnalysisDecision,
        prompt=PromptTemplate(template=analyze_prompt),
        user_request=user_request,
        context_str=context_str,
        conversation_context=conversation_context,
        enhanced_prompt=enhanced_prompt,
    )
    return res


async def research(
    question: str,
    context_nodes: List[NodeWithScore],
) -> str:
    prompt = """
    You are a researcher who is in the process of answering the question.
    The purpose is to answer the question based on the collected information, without using prior knowledge or making up any new information.
    Always add citations to the sentence/point/paragraph using the id of the provided content.
    The citation should follow this format: [citation:id] where id is the id of the content.
    
    E.g:
    If we have a context like this:
    <Citation id='abc-xyz'>
    Baby llama is called cria
    </Citation id='abc-xyz'>

    And your answer uses the content, then the citation should be:
    - Baby llama is called cria [citation:abc-xyz]

    Here is the provided context for the question:
    <Collected information>
    {context_str}
    </Collected information>`

    No prior knowledge, just use the provided context to answer the question: {question}
    """
    context_str = "\n".join(
        [_get_text_node_content_for_citation(node) for node in context_nodes]
    )
    res = await Settings.llm.acomplete(
        prompt=prompt.format(question=question, context_str=context_str),
    )
    return res.text


async def write_report(
    memory: SimpleComposableMemory,
    user_request: str,
    stream: bool = False,
) -> CompletionResponse | CompletionResponseAsyncGen:
    report_prompt = """
    You are a researcher writing a report based on a user request and the research context.
    You have researched various perspectives related to the user request.
    The report should provide a comprehensive outline covering all important points from the researched perspectives.
    Create a well-structured outline for the research report that covers all the answers.

    # IMPORTANT when writing in markdown format:
    + Use tables or figures where appropriate to enhance presentation.
    + Preserve all citation syntax (the `[citation:id]()` parts in the provided context). Keep these citations in the final report - no separate reference section is needed.
    + Do not add links, a table of contents, or a references section to the report.

    <User request>
    {user_request}
    </User request>

    <Research context>
    {research_context}
    </Research context>

    Now, write a report addressing the user request based on the research provided following the format and guidelines above.
    """
    research_context = "\n".join(
        [f"{message.role}: {message.content}" for message in memory.get_all()]
    )

    llm_complete_func = (
        Settings.llm.astream_complete if stream else Settings.llm.acomplete
    )

    res = await llm_complete_func(
        prompt=report_prompt.format(
            user_request=user_request,
            research_context=research_context,
        ),
    )
    return res


def _get_text_node_content_for_citation(node: NodeWithScore) -> str:
    """
    Construct node content for LLM with citation flag.
    """
    node_id = node.node.node_id
    content = f"<Citation id='{node_id}'>\n{node.get_content(metadata_mode=MetadataMode.LLM)}</Citation id='{node_id}'>"
    return content
