import os
from typing import Any, Dict, List, Optional

from app.engine.index import IndexConfig, get_index
from app.engine.tools import ToolFactory
from app.workflows.events import AgentRunEvent
from app.workflows.tools import (
    call_tools,
    chat_with_tools,
)
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


def create_workflow(
    chat_history: Optional[List[ChatMessage]] = None,
    params: Optional[Dict[str, Any]] = None,
    filters: Optional[List[Any]] = None,
) -> Workflow:
    if params is None:
        params = {}
    if filters is None:
        filters = []
    index_config = IndexConfig(**params)
    index: VectorStoreIndex = get_index(config=index_config)
    if index is None:
        query_engine_tool = None
    else:
        top_k = int(os.getenv("TOP_K", 10))
        query_engine = index.as_query_engine(similarity_top_k=top_k, filters=filters)
        query_engine_tool = QueryEngineTool.from_defaults(query_engine=query_engine)

    configured_tools = ToolFactory.from_env(map_result=True)
    extractor_tool = configured_tools.get("extract_questions")  # type: ignore
    filling_tool = configured_tools.get("fill_form")  # type: ignore

    workflow = FormFillingWorkflow(
        query_engine_tool=query_engine_tool,
        extractor_tool=extractor_tool,  # type: ignore
        filling_tool=filling_tool,  # type: ignore
        chat_history=chat_history,
    )

    return workflow


class InputEvent(Event):
    input: List[ChatMessage]
    response: bool = False


class ExtractMissingCellsEvent(Event):
    tool_calls: list[ToolSelection]


class FindAnswersEvent(Event):
    tool_calls: list[ToolSelection]


class FillEvent(Event):
    tool_calls: list[ToolSelection]


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
    Only extract missing cells from CSV files.
    Only use provided data - never make up any information yourself. Fill N/A if an answer is not found.
    If there is no query engine tool or the gathered information has many N/A values indicating the questions don't match the data, respond with a warning and ask the user to upload a different file or connect to a knowledge base.
    """

    def __init__(
        self,
        query_engine_tool: Optional[QueryEngineTool],
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
        assert self.extractor_tool is not None and self.filling_tool is not None
        self.tools = [self.extractor_tool, self.filling_tool]
        if self.query_engine_tool is not None:
            self.tools.append(self.query_engine_tool)  # type: ignore
        self.llm: FunctionCallingLLM = llm or Settings.llm
        if not isinstance(self.llm, FunctionCallingLLM):
            raise ValueError("FormFillingWorkflow only supports FunctionCallingLLM.")
        self.memory = ChatMemoryBuffer.from_defaults(
            llm=self.llm, chat_history=self.chat_history
        )

    @step()
    async def start(self, ctx: Context, ev: StartEvent) -> InputEvent:
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

    @step()
    async def handle_llm_input(  # type: ignore
        self,
        ctx: Context,
        ev: InputEvent,
    ) -> ExtractMissingCellsEvent | FillEvent | StopEvent:
        """
        Handle an LLM input and decide the next step.
        """
        chat_history: list[ChatMessage] = ev.input
        response = await chat_with_tools(
            self.llm,
            self.tools,
            chat_history,
        )
        if not response.has_tool_calls():
            return StopEvent(result=response.generator)
        # calling different tools at the same time is not supported at the moment
        # add an error message to tell the AI to process step by step
        if response.is_calling_different_tools():
            self.memory.put(
                ChatMessage(
                    role=MessageRole.ASSISTANT,
                    content="Cannot call different tools at the same time. Try calling one tool at a time.",
                )
            )
            return InputEvent(input=self.memory.get())
        self.memory.put(response.tool_call_message)
        match response.tool_name():
            case self.extractor_tool.metadata.name:
                return ExtractMissingCellsEvent(tool_calls=response.tool_calls)
            case self.query_engine_tool.metadata.name:
                return FindAnswersEvent(tool_calls=response.tool_calls)
            case self.filling_tool.metadata.name:
                return FillEvent(tool_calls=response.tool_calls)
            case _:
                raise ValueError(f"Unknown tool: {response.tool_name()}")

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
        tool_messages = await call_tools(
            agent_name="Extractor",
            tools=[self.extractor_tool],
            ctx=ctx,
            tool_calls=ev.tool_calls,
        )
        self.memory.put_messages(tool_messages)
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
        tool_messages = await call_tools(
            ctx=ctx,
            agent_name="Researcher",
            tools=[self.query_engine_tool],
            tool_calls=ev.tool_calls,
        )
        self.memory.put_messages(tool_messages)
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
        tool_messages = await call_tools(
            agent_name="Processor",
            tools=[self.filling_tool],
            ctx=ctx,
            tool_calls=ev.tool_calls,
        )
        self.memory.put_messages(tool_messages)
        return InputEvent(input=self.memory.get())
