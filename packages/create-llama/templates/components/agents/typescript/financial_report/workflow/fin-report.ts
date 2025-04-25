import {
  HandlerContext,
  StartEvent,
  StopEvent,
  Workflow,
  WorkflowEvent,
} from "@llamaindex/workflow";
import {
  BaseToolWithCall,
  ChatMemoryBuffer,
  ChatMessage,
  ChatResponseChunk,
  Settings,
  ToolCall,
  ToolCallLLM,
} from "llamaindex";
import { callTools, chatWithTools } from "./tools";
import { AgentInput, AgentRunEvent } from "./type";

// Create a custom event type
class InputEvent extends WorkflowEvent<{ input: ChatMessage[] }> {}

class ResearchEvent extends WorkflowEvent<{
  toolCalls: ToolCall[];
}> {}

class AnalyzeEvent extends WorkflowEvent<{
  input: ChatMessage | ToolCall[];
}> {}

class ReportGenerationEvent extends WorkflowEvent<{
  toolCalls: ToolCall[];
}> {}

const DEFAULT_SYSTEM_PROMPT = `
You are a financial analyst who are given a set of tools to help you.
It's good to using appropriate tools for the user request and always use the information from the tools, don't make up anything yourself.
For the query engine tool, you should break down the user request into a list of queries and call the tool with the queries.
`;

export class FinancialReportWorkflow extends Workflow<
  null,
  AgentInput,
  ChatResponseChunk
> {
  llm: ToolCallLLM;
  memory: ChatMemoryBuffer;
  queryEngineTool: BaseToolWithCall;
  codeInterpreterTool: BaseToolWithCall;
  documentGeneratorTool: BaseToolWithCall;
  systemPrompt?: string;

  constructor(options: {
    llm?: ToolCallLLM;
    chatHistory: ChatMessage[];
    queryEngineTool: BaseToolWithCall;
    codeInterpreterTool: BaseToolWithCall;
    documentGeneratorTool: BaseToolWithCall;
    systemPrompt?: string;
    verbose?: boolean;
    timeout?: number;
  }) {
    super({
      verbose: options?.verbose ?? false,
      timeout: options?.timeout ?? 360,
    });

    this.llm = options.llm ?? (Settings.llm as ToolCallLLM);
    if (!(this.llm instanceof ToolCallLLM)) {
      throw new Error("LLM is not a ToolCallLLM");
    }
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.queryEngineTool = options.queryEngineTool;
    this.codeInterpreterTool = options.codeInterpreterTool;

    this.documentGeneratorTool = options.documentGeneratorTool;
    this.memory = new ChatMemoryBuffer({
      llm: this.llm,
      chatHistory: options.chatHistory,
    });

    // Add steps
    this.addStep(
      {
        inputs: [StartEvent<AgentInput>],
        outputs: [InputEvent],
      },
      this.prepareChatHistory,
    );

    this.addStep(
      {
        inputs: [InputEvent],
        outputs: [
          InputEvent,
          ResearchEvent,
          AnalyzeEvent,
          ReportGenerationEvent,
          StopEvent,
        ],
      },
      this.handleLLMInput,
    );

    this.addStep(
      {
        inputs: [ResearchEvent],
        outputs: [AnalyzeEvent],
      },
      this.handleResearch,
    );

    this.addStep(
      {
        inputs: [AnalyzeEvent],
        outputs: [InputEvent],
      },
      this.handleAnalyze,
    );

    this.addStep(
      {
        inputs: [ReportGenerationEvent],
        outputs: [InputEvent],
      },
      this.handleReportGeneration,
    );
  }

  prepareChatHistory = async (
    ctx: HandlerContext<null>,
    ev: StartEvent<AgentInput>,
  ): Promise<InputEvent> => {
    const { message } = ev.data;

    if (this.systemPrompt) {
      this.memory.put({ role: "system", content: this.systemPrompt });
    }
    this.memory.put({ role: "user", content: message });

    return new InputEvent({ input: this.memory.getMessages() });
  };

  handleLLMInput = async (
    ctx: HandlerContext<null>,
    ev: InputEvent,
  ): Promise<
    | InputEvent
    | ResearchEvent
    | AnalyzeEvent
    | ReportGenerationEvent
    | StopEvent
  > => {
    const chatHistory = ev.data.input;

    const tools = [
      this.codeInterpreterTool,
      this.documentGeneratorTool,
      this.queryEngineTool,
    ];

    const toolCallResponse = await chatWithTools(this.llm, tools, chatHistory);

    if (!toolCallResponse.hasToolCall()) {
      return new StopEvent(toolCallResponse.responseGenerator);
    }

    if (toolCallResponse.hasMultipleTools()) {
      this.memory.put({
        role: "assistant",
        content:
          "Calling different tools is not allowed. Please only use multiple calls of the same tool.",
      });
      return new InputEvent({ input: this.memory.getMessages() });
    }

    // Put the LLM tool call message into the memory
    // And trigger the next step according to the tool call
    if (toolCallResponse.toolCallMessage) {
      this.memory.put(toolCallResponse.toolCallMessage);
    }
    const toolName = toolCallResponse.getToolNames()[0];
    switch (toolName) {
      case this.codeInterpreterTool.metadata.name:
        return new AnalyzeEvent({
          input: toolCallResponse.toolCalls,
        });
      case this.documentGeneratorTool.metadata.name:
        return new ReportGenerationEvent({
          toolCalls: toolCallResponse.toolCalls,
        });
      default:
        if (this.queryEngineTool.metadata.name === toolName) {
          return new ResearchEvent({
            toolCalls: toolCallResponse.toolCalls,
          });
        }
        throw new Error(`Unknown tool: ${toolName}`);
    }
  };

  handleResearch = async (
    ctx: HandlerContext<null>,
    ev: ResearchEvent,
  ): Promise<AnalyzeEvent> => {
    ctx.sendEvent(
      new AgentRunEvent({
        agent: "Researcher",
        text: "Researching data",
        type: "text",
      }),
    );

    const { toolCalls } = ev.data;

    const toolMsgs = await callTools({
      tools: [this.queryEngineTool],
      toolCalls,
      ctx,
      agentName: "Researcher",
    });
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new AnalyzeEvent({
      input: {
        role: "assistant",
        content:
          "I have finished researching the data, please analyze the data.",
      },
    });
  };

  /**
   * Analyze a research result or a tool call for code interpreter from the LLM
   */
  handleAnalyze = async (
    ctx: HandlerContext<null>,
    ev: AnalyzeEvent,
  ): Promise<InputEvent> => {
    ctx.sendEvent(
      new AgentRunEvent({
        agent: "Analyst",
        text: `Starting analysis`,
        type: "text",
      }),
    );
    // Request by workflow LLM, input is a list of tool calls
    let toolCalls: ToolCall[] = [];
    if (Array.isArray(ev.data.input)) {
      toolCalls = ev.data.input;
    } else {
      // Requested by Researcher, input is a ChatMessage
      // We start new LLM chat specifically for analyzing the data
      const analysisPrompt = `
      You are an expert in analyzing financial data.
      You are given a set of financial data to analyze. Your task is to analyze the financial data and return a report.
      Your response should include a detailed analysis of the financial data, including any trends, patterns, or insights that you find.
      Construct the analysis in textual format; including tables would be great!
      Don't need to synthesize the data, just analyze and provide your findings.
      `;

      // Clone the current chat history
      // Add the analysis system prompt and the message from the researcher
      const newChatHistory = [
        ...this.memory.getMessages(),
        { role: "system", content: analysisPrompt },
        ev.data.input,
      ];
      const toolCallResponse = await chatWithTools(
        this.llm,
        [this.codeInterpreterTool],
        newChatHistory as ChatMessage[],
      );

      if (!toolCallResponse.hasToolCall()) {
        this.memory.put(await toolCallResponse.asFullResponse());
        return new InputEvent({
          input: this.memory.getMessages(),
        });
      } else {
        this.memory.put(toolCallResponse.toolCallMessage);
        toolCalls = toolCallResponse.toolCalls;
      }
    }

    // Call the tools
    const toolMsgs = await callTools({
      tools: [this.codeInterpreterTool],
      toolCalls,
      ctx,
      agentName: "Analyst",
    });
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }

    return new InputEvent({
      input: this.memory.getMessages(),
    });
  };

  handleReportGeneration = async (
    ctx: HandlerContext<null>,
    ev: ReportGenerationEvent,
  ): Promise<InputEvent> => {
    const { toolCalls } = ev.data;

    const toolMsgs = await callTools({
      tools: [this.documentGeneratorTool],
      toolCalls,
      ctx,
      agentName: "Reporter",
    });
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: this.memory.getMessages() });
  };
}
