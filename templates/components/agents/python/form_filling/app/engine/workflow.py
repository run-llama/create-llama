import json
import os
import uuid
from enum import Enum
from typing import List, Optional

from app.engine.tools.form_filling import CellValue, MissingCell
from llama_index.core import Settings
from llama_index.core.base.llms.types import ChatMessage, MessageRole
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.tools import FunctionTool, QueryEngineTool, ToolSelection
from llama_index.core.tools.types import ToolOutput
from llama_index.core.workflow import (
    Context,
    Event,
    StartEvent,
    StopEvent,
    Workflow,
    step,
)
from llama_index.llms.openai import OpenAI
from pydantic import Field


class InputEvent(Event):
    input: List[ChatMessage]
    response: bool = False


class ExtractMissingCellsEvent(Event):
    tool_call: ToolSelection


class FindAnswersEvent(Event):
    tool_call: ToolSelection


class FillEvent(Event):
    tool_call: ToolSelection


class AgentRunEventType(Enum):
    TEXT = "text"
    PROGRESS = "progress"


class AgentRunEvent(Event):
    name: str
    msg: str
    event_type: AgentRunEventType = Field(default=AgentRunEventType.TEXT)

    def to_response(self) -> dict:
        return {
            "type": "agent",
            "data": {
                "name": self.name,
                "event_type": self.event_type.value,
                "msg": self.msg,
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

    def __init__(
        self,
        query_engine_tool: QueryEngineTool,
        extractor_tool: FunctionTool,
        filling_tool: FunctionTool,
        llm: Optional[OpenAI] = None,
        timeout: int = 360,
        chat_history: Optional[List[ChatMessage]] = None,
        system_prompt: Optional[str] = None,
    ):
        super().__init__(timeout=timeout)
        self.system_prompt = system_prompt or os.getenv("SYSTEM_PROMPT", "")
        self.chat_history = chat_history or []
        self.query_engine_tool = query_engine_tool
        self.extractor_tool = extractor_tool
        self.filling_tool = filling_tool
        self.tools = [self.query_engine_tool, self.extractor_tool, self.filling_tool]
        self.tool_mapper = {
            self.extractor_tool.metadata.get_name(): self.extractor_tool,
            self.filling_tool.metadata.get_name(): self.filling_tool,
        }
        self.llm: OpenAI = llm or Settings.llm
        if not isinstance(self.llm, OpenAI):
            raise ValueError("FormFillingWorkflow only supports OpenAI LLM.")
        self.memory = ChatMemoryBuffer.from_defaults(llm=self.llm)

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
    async def handle_llm_input(
        self,
        ctx: Context,
        ev: InputEvent,
    ) -> ExtractMissingCellsEvent | FindAnswersEvent | FillEvent | StopEvent:
        """
        Handle an LLM input and decide the next step.
        """
        chat_history: list[ChatMessage] = ev.input
        # If the response flag is True, it means the LLM has finished the task and we need to stream the response
        if ev.response:
            # Stream the response
            res = await self.llm.astream_chat(
                messages=chat_history,
            )
            return StopEvent(result=res)

        # Call LLM with tools
        response = await self.llm.achat_with_tools(
            tools=self.tools,
            chat_history=chat_history,
        )
        self.memory.put(response.message)

        # If tool calls are found, call it accordingly
        tool_calls = self.llm.get_tool_calls_from_response(
            response, error_on_no_tool_call=False
        )
        for tool_call in tool_calls:
            if tool_call.tool_name == self.extractor_tool.metadata.get_name():
                return ExtractMissingCellsEvent(tool_call=tool_call)
            elif tool_call.tool_name == self.query_engine_tool.metadata.get_name():
                return FindAnswersEvent(tool_call=tool_call)
            elif tool_call.tool_name == self.filling_tool.metadata.get_name():
                return FillEvent(tool_call=tool_call)

        # Otherwise, just response the LLM's response without calling any tools
        def generator():
            for chunk in response.message.content:
                yield chunk

        return StopEvent(result=generator())

    @step()
    async def extract_missing_cells(
        self, ctx: Context, ev: ExtractMissingCellsEvent
    ) -> InputEvent:
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
        response = self._call_tool(
            ctx,
            agent_name="Extractor",
            tool=self.extractor_tool,
            tool_selection=ev.tool_call,
        )
        if response.is_error:
            return InputEvent(input=self.memory.get())

        missing_cells = response.raw_output.get("missing_cells", [])
        ctx.data["missing_cells"] = missing_cells
        message = ChatMessage(
            role=MessageRole.TOOL,
            content=str(missing_cells),
            additional_kwargs={
                "tool_call_id": ev.tool_call.tool_id,
                "name": ev.tool_call.tool_name,
            },
        )
        self.memory.put(message)

        # send input event back with updated chat history
        return InputEvent(input=self.memory.get())

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
        missing_cells = ctx.data.get("missing_cells", None)
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
        for i, missing_cell in enumerate(missing_cells):
            cell = MissingCell(**missing_cell)
            if cell.question_to_answer is None:
                continue
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name="Researcher",
                    # TODO: Add typing for the progress message
                    msg=json.dumps(
                        {
                            "progress_id": progress_id,
                            "total_steps": total_steps,
                            "current_step": i,
                            "step_msg": f"Querying for: {cell.question_to_answer}",
                        }
                    ),
                    event_type=AgentRunEventType.PROGRESS,
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
        message = ChatMessage(
            role=MessageRole.TOOL,
            content=str(cell_values),
            additional_kwargs={
                "tool_call_id": ev.tool_call.tool_id,
                "name": ev.tool_call.tool_name,
            },
        )
        self.memory.put(message)
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

    # TODO: Implement a _acall_tool method
    def _call_tool(
        self,
        ctx: Context,
        agent_name: str,
        tool: FunctionTool,
        tool_selection: ToolSelection,
    ) -> ToolOutput:
        """
        Safely call a tool and handle errors.
        """
        try:
            response: ToolOutput = tool.call(**tool_selection.tool_kwargs)
            return response
        except Exception as e:
            ctx.write_event_to_stream(
                AgentRunEvent(
                    name=agent_name,
                    msg=f"Error: {str(e)}",
                )
            )
            message = ChatMessage(
                role=MessageRole.TOOL,
                content=f"Error: {str(e)}",
                additional_kwargs={
                    "tool_call_id": tool_selection.tool_id,
                    "name": tool.metadata.get_name(),
                },
            )
            self.memory.put(message)
            return ToolOutput(
                content=f"Error: {str(e)}",
                tool_name=tool.metadata.get_name(),
                raw_input=tool_selection.tool_kwargs,
                raw_output=None,
                is_error=True,
            )
