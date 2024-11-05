import os
import uuid
from enum import Enum
from typing import List, Optional

from app.engine.index import get_index
from app.engine.tools import ToolFactory
from app.engine.tools.form_filling import CellValue, MissingCell
from llama_index.core import Settings
from llama_index.core.base.llms.types import ChatMessage, MessageRole
from llama_index.core.indices.vector_store import VectorStoreIndex
from llama_index.core.llms.function_calling import FunctionCallingLLM
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.tools import FunctionTool, QueryEngineTool, ToolSelection
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)
from pydantic import Field


def create_workflow(
    chat_history: Optional[List[ChatMessage]] = None, **kwargs
) -> Workflow:
    index: VectorStoreIndex = get_index()
    if index is None:
        query_engine_tool = None
    else:
        top_k = int(os.getenv("TOP_K", 10))
        query_engine = index.as_query_engine(similarity_top_k=top_k)
        query_engine_tool = QueryEngineTool.from_defaults(query_engine=query_engine)

    configured_tools = ToolFactory.from_env(map_result=True)
    extractor_tool = configured_tools.get("extract_questions")
    filling_tool = configured_tools.get("fill_form")

    if extractor_tool is None or filling_tool is None:
        raise ValueError("Extractor or filling tool is not found!")

    workflow = FormFillingWorkflow(
        query_engine_tool=query_engine_tool,
        extractor_tool=extractor_tool,
        filling_tool=filling_tool,
        chat_history=chat_history,
    )

    return workflow


class InputEvent(Event):
    input: List[ChatMessage]
    response: bool = False


class ExtractMissingCellsEvent(Event):
    tool_call: ToolSelection


class FindAnswersEvent(Event):
    missing_cells: list[MissingCell]


class FillEvent(Event):
    tool_call: ToolSelection


class AgentRunEventType(Enum):
    TEXT = "text"
    PROGRESS = "progress"


class AgentRunEvent(Event):
    name: str
    msg: str
    event_type: AgentRunEventType = Field(default=AgentRunEventType.TEXT)
    data: Optional[dict] = None

    def to_response(self) -> dict:
        return {
            "type": "agent",
            "data": {
                "agent": self.name,
                "type": self.event_type.value,
                "text": self.msg,
                "data": self.data,
            },
        }


class FormFillingWorkflow(Workflow):
    """
    A predefined workflow for filling missing cells in a CSV file.
    Required tools:
    - query_engine: A query engine to query for the answers to the questions.
    - extract_question: Extract missing cells in a CSV file and generate questions to fill them.
    - answer_question: Query for the answers to the questions.

    Flow:
    1. Extract missing cells in a CSV file and generate questions to fill them.
    2. Query for the answers to the questions.
    3. Fill the missing cells with the answers.
    """

    _default_system_prompt = """
    You are a helpful assistant who helps fill missing cells in a CSV file.
    Only use provided data, never make up any information yourself. Fill N/A if the answer is not found.
    """

    def __init__(
        self,
        query_engine_tool: QueryEngineTool,
        extractor_tool: FunctionTool,
        filling_tool: FunctionTool,
        llm: Optional[FunctionCallingLLM] = None,
        timeout: int = 360,
        chat_history: Optional[List[ChatMessage]] = None,
        system_prompt: Optional[str] = None,
    ):
        super().__init__(timeout=timeout)
        self.system_prompt = system_prompt or self._default_system_prompt
        self.chat_history = chat_history or []
        self.query_engine_tool = query_engine_tool
        self.extractor_tool = extractor_tool
        self.filling_tool = filling_tool
        self.llm: FunctionCallingLLM = llm or Settings.llm
        if not isinstance(self.llm, FunctionCallingLLM):
            raise ValueError("FormFillingWorkflow only supports FunctionCallingLLM.")
        self.memory = ChatMemoryBuffer.from_defaults(
            llm=self.llm, chat_history=self.chat_history
        )

    @step()
    async def start(self, ctx: Context, ev: StartEvent) -> InputEvent:
        ctx.data["streaming"] = getattr(ev, "streaming", False)
        ctx.data["input"] = ev.input

        if self.system_prompt:
            system_msg = ChatMessage(
                role=MessageRole.SYSTEM, content=self.system_prompt
            )
            self.memory.put(system_msg)

        user_input = ev.input
        user_msg = ChatMessage(role=MessageRole.USER, content=user_input)
        self.memory.put(user_msg)

        chat_history = self.memory.get()
        return InputEvent(input=chat_history)

    @step(pass_context=True)
    async def handle_llm_input(  # type: ignore
        self,
        ctx: Context,
        ev: InputEvent,
    ) -> ExtractMissingCellsEvent | FillEvent | StopEvent:
        """
        Handle an LLM input and decide the next step.
        """
        chat_history: list[ChatMessage] = ev.input
        # TODO: Using the helper tool call generator
        generator = self._tool_call_generator(chat_history)

        # Check for immediate tool call
        is_tool_call = await generator.__anext__()
        if is_tool_call:
            full_response = await generator.__anext__()
            tool_calls = self.llm.get_tool_calls_from_response(full_response)  # type: ignore
            for tool_call in tool_calls:
                if tool_call.tool_name == self.extractor_tool.metadata.get_name():
                    ctx.send_event(ExtractMissingCellsEvent(tool_call=tool_call))
                elif tool_call.tool_name == self.filling_tool.metadata.get_name():
                    ctx.send_event(FillEvent(tool_call=tool_call))
        else:
            # If no tool call, return the generator
            return StopEvent(result=generator)

    @step()
    async def extract_missing_cells(
        self, ctx: Context, ev: ExtractMissingCellsEvent
    ) -> InputEvent | FindAnswersEvent:
        """
        Extract missing cells in a CSV file and generate questions to fill them.
        """
        ctx.write_event_to_stream(
            AgentRunEvent(
                name="Extractor",
                msg="Extracting missing cells",
            )
        )
        # Call the extract questions tool
        # TODO: Using the helper tool caller
        response = self._call_tool(
            ctx,
            agent_name="Extractor",
            tool=self.extractor_tool,
            tool_selection=ev.tool_call,
        )
        if response.is_error:
            return InputEvent(input=self.memory.get())

        missing_cells = response.raw_output.get("missing_cells", [])
        message = ChatMessage(
            role=MessageRole.TOOL,
            content=str(missing_cells),
            additional_kwargs={
                "tool_call_id": ev.tool_call.tool_id,
                "name": ev.tool_call.tool_name,
            },
        )
        self.memory.put(message)

        if self.query_engine_tool is None:
            # Fallback to input that query engine tool is not found so that cannot answer questions
            self.memory.put(
                ChatMessage(
                    role=MessageRole.ASSISTANT,
                    content="Extracted missing cells but query engine tool is not found so cannot answer questions. Ask user to upload file or connect to a knowledge base.",
                )
            )
            return InputEvent(input=self.memory.get())

        # Forward missing cells information to find answers step
        return FindAnswersEvent(missing_cells=missing_cells)

    @step()
    async def find_answers(self, ctx: Context, ev: FindAnswersEvent) -> InputEvent:
        """
        Call answer questions tool to query for the answers to the questions.
        """
        ctx.write_event_to_stream(
            AgentRunEvent(
                name="Researcher",
                msg="Finding answers for missing cells",
            )
        )
        missing_cells = ev.missing_cells
        # If missing cells information is not found, fallback to other tools
        # It means that the extractor tool has not been called yet
        # Fallback to input
        if missing_cells is None:
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name="Researcher",
                    msg="Error: Missing cells information not found. Fallback to other tools.",
                )
            )
            message = ChatMessage(
                role=MessageRole.TOOL,
                content="Error: Missing cells information not found.",
                additional_kwargs={
                    "tool_call_id": ev.tool_call.tool_id,
                    "name": ev.tool_call.tool_name,
                },
            )
            self.memory.put(message)
            return InputEvent(input=self.memory.get())

        cell_values: list[CellValue] = []
        # Iterate over missing cells and query for the answers
        # and stream the progress
        progress_id = str(uuid.uuid4())
        total_steps = len(missing_cells)
        for i, cell in enumerate(missing_cells):
            if cell.question_to_answer is None:
                continue
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name="Researcher",
                    msg=f"Querying for: {cell.question_to_answer}",
                    event_type=AgentRunEventType.PROGRESS,
                    data={
                        "id": progress_id,
                        "total": total_steps,
                        "current": i,
                    },
                )
            )
            # Call query engine tool directly
            answer = await self.query_engine_tool.acall(query=cell.question_to_answer)
            cell_values.append(
                CellValue(
                    row_index=cell.row_index,
                    column_index=cell.column_index,
                    value=str(answer),
                )
            )
        self.memory.put(
            ChatMessage(
                role=MessageRole.ASSISTANT,
                content=str(cell_values),
            )
        )
        return InputEvent(input=self.memory.get())

    @step()
    async def fill_cells(self, ctx: Context, ev: FillEvent) -> InputEvent:
        """
        Call fill cells tool to fill the missing cells with the answers.
        """
        ctx.write_event_to_stream(
            AgentRunEvent(
                name="Processor",
                msg="Filling missing cells",
            )
        )
        # Call the fill cells tool
        # TODO: Using the helper  tool caller
        result = self._call_tool(
            ctx,
            agent_name="Processor",
            tool=self.filling_tool,
            tool_selection=ev.tool_call,
        )
        if result.is_error:
            return InputEvent(input=self.memory.get())

        message = ChatMessage(
            role=MessageRole.TOOL,
            content=str(result.raw_output),
            additional_kwargs={
                "tool_call_id": ev.tool_call.tool_id,
                "name": ev.tool_call.tool_name,
            },
        )
        self.memory.put(message)
        return InputEvent(input=self.memory.get(), response=True)
