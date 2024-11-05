import os
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.engine.index import IndexConfig, get_index
from app.engine.tools import ToolFactory
from app.workflows.events import AgentRunEvent
from app.workflows.tools import call_tools, tool_calls_or_response
from llama_index.core import Settings
from llama_index.core.base.llms.types import ChatMessage, ChatResponse, MessageRole
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
    index_config = IndexConfig(**params)
    index: VectorStoreIndex = get_index(config=index_config)
    if index is None:
        query_engine_tool = None
    else:
        top_k = int(os.getenv("TOP_K", 10))
        query_engine = index.as_query_engine(similarity_top_k=top_k, filters=filters)
        query_engine_tool = QueryEngineTool.from_defaults(query_engine=query_engine)

    configured_tools: Dict[str, FunctionTool] = ToolFactory.from_env(map_result=True)  # type: ignore
    code_interpreter_tool = configured_tools.get("interpret")
    document_generator_tool = configured_tools.get("generate_document")

    if code_interpreter_tool is None or document_generator_tool is None:
        raise ValueError(
            "Code interpreter or document generator tool is not configured"
        )

    return FinancialReportWorkflow(
        query_engine_tool=query_engine_tool,
        code_interpreter_tool=code_interpreter_tool,
        document_generator_tool=document_generator_tool,
        chat_history=chat_history,
    )


class InputEvent(Event):
    input: List[ChatMessage]
    response: bool = False


class ResearchEvent(Event):
    input: list[ToolSelection]


class AnalyzeEvent(Event):
    input: list[ToolSelection] | ChatMessage


class ReportEvent(Event):
    input: list[ToolSelection]


class FinancialReportWorkflow(Workflow):
    """
    A workflow to generate a financial report using indexed documents.

    Requirements:
    - Indexed documents containing financial data and a query engine tool to search them
    - A code interpreter tool to analyze data and generate reports
    - A document generator tool to create report files

    Steps:
    1. LLM Input: The LLM determines the next step based on function calling.
       For example, if the model requests the query engine tool, it returns a ResearchEvent;
       if it requests document generation, it returns a ReportEvent.
    2. Research: Uses the query engine to find relevant chunks from indexed documents.
       After gathering information, it requests analysis (step 3).
    3. Analyze: Uses a custom prompt to analyze research results and can call the code
       interpreter tool for visualization or calculation. Returns results to the LLM.
    4. Report: Uses the document generator tool to create a report. Returns results to the LLM.
    """

    _default_system_prompt = """
    You are a financial analyst who are given a set of tools to help you.
    It's good to using appropriate tools for the user request and always use the information from the tools, don't make up anything yourself.
    For the query engine tool, you should break down the user request into a list of queries and call the tool with the queries.
    """

    def __init__(
        self,
        query_engine_tool: QueryEngineTool,
        code_interpreter_tool: FunctionTool,
        document_generator_tool: FunctionTool,
        llm: Optional[FunctionCallingLLM] = None,
        timeout: int = 360,
        chat_history: Optional[List[ChatMessage]] = None,
        system_prompt: Optional[str] = None,
    ):
        super().__init__(timeout=timeout)
        self.system_prompt = system_prompt or self._default_system_prompt
        self.chat_history = chat_history or []
        self.query_engine_tool = query_engine_tool
        self.code_interpreter_tool = code_interpreter_tool
        self.document_generator_tool = document_generator_tool
        self.llm: FunctionCallingLLM = llm or Settings.llm
        assert isinstance(self.llm, FunctionCallingLLM)
        self.memory = ChatMemoryBuffer.from_defaults(
            llm=self.llm, chat_history=self.chat_history
        )

    @step()
    async def prepare_chat_history(self, ctx: Context, ev: StartEvent) -> InputEvent:
        ctx.data["streaming"] = getattr(ev, "streaming", False)
        ctx.data["input"] = ev.input

        if self.system_prompt:
            system_msg = ChatMessage(
                role=MessageRole.SYSTEM, content=self.system_prompt
            )
            self.memory.put(system_msg)

        # Add user input to memory
        self.memory.put(ChatMessage(role=MessageRole.USER, content=ev.input))

        return InputEvent(input=self.memory.get())

    @step()
    async def handle_llm_input(  # type: ignore
        self,
        ctx: Context,
        ev: InputEvent,
    ) -> ResearchEvent | AnalyzeEvent | ReportEvent | StopEvent:
        """
        Handle an LLM input and decide the next step.
        """
        # Always use the latest chat history from the input
        chat_history: list[ChatMessage] = ev.input

        # Get tool calls
        tool_calls, response = await tool_calls_or_response(
            self.llm,
            [
                self.query_engine_tool,
                self.code_interpreter_tool,
                self.document_generator_tool,
            ],
            chat_history,
        )
        if tool_calls is None:
            # If no tool call, return the response generator
            return StopEvent(result=response)
        else:
            # Grouping tool calls to the same agent
            # We need to group them by the agent name
            tool_groups: Dict[str, List[ToolSelection]] = {}
            for tool_call in tool_calls:
                tool_groups.setdefault(tool_call.tool_name, []).append(tool_call)  # type: ignore

            # LLM Input step use the function calling to define the next step
            # calling different step with tools at the same time is not supported at the moment
            # add an error message to tell the AI process step by step
            if len(tool_groups) > 1:
                self.memory.put(
                    ChatMessage(
                        role=MessageRole.ASSISTANT,
                        content="Cannot call different tools at the same time. Try calling one tool at a time.",
                    )
                )
                return InputEvent(input=self.memory.get())
            if isinstance(response, ChatResponse):
                self.memory.put(response.message)
            tool_name, tool_calls = list(tool_groups.items())[0]
            match tool_name:
                case self.query_engine_tool.metadata.name:
                    return ResearchEvent(input=tool_calls)
                case self.code_interpreter_tool.metadata.name:
                    return AnalyzeEvent(input=tool_calls)
                case self.document_generator_tool.metadata.name:
                    return ReportEvent(input=tool_calls)

    @step()
    async def research(self, ctx: Context, ev: ResearchEvent) -> AnalyzeEvent:
        """
        Do a research to gather information for the user's request.
        A researcher should have these tools: query engine, search engine, etc.
        """
        ctx.write_event_to_stream(
            AgentRunEvent(
                name="Researcher",
                msg="Starting research",
            )
        )
        tool_calls = ev.input

        tool_messages = await call_tools(
            ctx=ctx,
            agent_name="Researcher",
            tools=[self.query_engine_tool],
            tool_calls=tool_calls,
        )
        self.memory.put_messages(tool_messages)
        # Request to analyze the research result
        message = ChatMessage(
            role=MessageRole.ASSISTANT,
            content="I've finished the research. Please analyze the result.",
        )
        return AnalyzeEvent(input=message)

    @step()
    async def analyze(self, ctx: Context, ev: AnalyzeEvent) -> InputEvent:
        """
        Analyze the research result.
        """
        ctx.write_event_to_stream(
            AgentRunEvent(
                name="Analyst",
                msg="Starting analysis",
            )
        )
        event_requested_by_workflow_llm = isinstance(ev.input, list)
        # Requested by the workflow LLM Input step, it's a tool call
        if event_requested_by_workflow_llm:
            tool_calls = ev.input
        else:
            # Otherwise, it's triggered by the research step
            # Use a custom prompt and independent memory for the analyst agent
            analysis_prompt = """
            You are a financial analyst, you are given a research result and a set of tools to help you.
            Always use the given information, don't make up anything yourself. If there is not enough information, you can asking for more information.
            If you have enough numerical information, it's good to include some charts/visualizations to the report so you can use the code interpreter tool to generate a report.
            """
            # This is handled by analyst agent
            # Clone the shared memory to avoid conflicting with the workflow.
            chat_history = self.memory.get()
            chat_history.append(
                ChatMessage(role=MessageRole.SYSTEM, content=analysis_prompt)
            )
            chat_history.append(ev.input)  # type: ignore
            # Check if the analyst agent needs to call tools
            tool_calls, response = await tool_calls_or_response(
                self.llm,
                [self.code_interpreter_tool],
                chat_history,
            )
            if tool_calls is None:
                # If no tool call, fallback analyst message to the workflow
                full_response = ""
                if isinstance(response, AsyncGenerator):
                    async for chunk in response.__aiter__():
                        full_response += chunk.message.content
                    analyst_msg = ChatMessage(
                        role=MessageRole.ASSISTANT, content=full_response
                    )
                else:
                    analyst_msg = response.message
                self.memory.put(analyst_msg)
                return InputEvent(input=self.memory.get_all())
            else:
                # Put the tool request message to the memory
                self.memory.put(response.message)
        # Call tools
        tool_messages = await call_tools(
            ctx=ctx,
            agent_name="Analyst",
            tools=[self.code_interpreter_tool],
            tool_calls=tool_calls,  # type: ignore
        )
        self.memory.put_messages(tool_messages)

        # After the tool calls, fallback to the input with the latest chat history
        return InputEvent(input=self.memory.get())

    @step()
    async def report(self, ctx: Context, ev: ReportEvent) -> InputEvent:
        """
        Generate a report based on the analysis result.
        """
        ctx.write_event_to_stream(
            AgentRunEvent(
                name="Reporter",
                msg="Starting report generation",
            )
        )
        tool_calls = ev.input
        tool_messages = await call_tools(
            ctx=ctx,
            agent_name="Reporter",
            tools=[self.document_generator_tool],
            tool_calls=tool_calls,
        )
        self.memory.put_messages(tool_messages)

        # After the tool calls, fallback to the input with the latest chat history
        return InputEvent(input=self.memory.get())
