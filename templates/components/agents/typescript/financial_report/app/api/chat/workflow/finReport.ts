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
  writeEvents?: boolean;

  constructor(options: {
    llm?: ToolCallLLM;
    chatHistory: ChatMessage[];
    queryEngineTool: BaseToolWithCall;
    codeInterpreterTool: BaseToolWithCall;
    documentGeneratorTool: BaseToolWithCall;
    systemPrompt?: string;
    writeEvents?: boolean;
    verbose?: boolean;
    timeout?: number;
  }) {
    super({
      verbose: options?.verbose ?? false,
      timeout: options?.timeout ?? 360,
    });

    this.llm = options.llm ?? (Settings.llm as ToolCallLLM);
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.writeEvents = options.writeEvents;
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
      this.prepareChatHistory.bind(this),
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
      this.handleLLMInput.bind(this),
    );

    this.addStep(
      {
        inputs: [ResearchEvent],
        outputs: [AnalyzeEvent],
      },
      this.handleResearch.bind(this),
    );

    this.addStep(
      {
        inputs: [AnalyzeEvent],
        outputs: [InputEvent],
      },
      this.handleAnalyze.bind(this),
    );

    this.addStep(
      {
        inputs: [ReportGenerationEvent],
        outputs: [InputEvent],
      },
      this.handleReportGeneration.bind(this),
    );
  }

  private async prepareChatHistory(
    ctx: HandlerContext<null>,
    ev: StartEvent<AgentInput>,
  ) {
    const { message } = ev.data;

    if (this.systemPrompt) {
      this.memory.put({ role: "system", content: this.systemPrompt });
    }
    this.memory.put({ role: "user", content: message });

    return new InputEvent({ input: this.memory.getMessages() });
  }

  private async handleLLMInput(ctx: HandlerContext<null>, ev: InputEvent) {
    const chatHistory = ev.data.input;

    const tools = [this.codeInterpreterTool, this.documentGeneratorTool];
    if (this.queryEngineTool) {
      tools.push(this.queryEngineTool);
    }

    const toolCallResponse = await chatWithTools(this.llm, tools, chatHistory);

    if (!toolCallResponse.hasToolCall()) {
      return new StopEvent({ result: toolCallResponse.responseGenerator });
    }

    if (toolCallResponse.hasMultipleTools()) {
      this.memory.put({
        role: "user",
        content:
          "Calling different tool is not allowed. Please only call one tool at a time.",
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
      case this.queryEngineTool?.metadata.name:
        return new ResearchEvent({
          toolCalls: toolCallResponse.toolCalls,
        });
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async handleResearch(ctx: HandlerContext<null>, ev: ResearchEvent) {
    ctx.sendEvent(
      new AgentRunEvent({
        name: "Researcher",
        text: "Researching data",
        type: "text",
      }),
    );

    const { toolCalls } = ev.data;

    const toolMsgs = await callTools(
      toolCalls,
      [this.queryEngineTool],
      ctx,
      "Researcher",
    );
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
  }

  /**
   * Analyze a research result or a tool call for code interpreter from the LLM
   */
  private async handleAnalyze(ctx: HandlerContext<null>, ev: AnalyzeEvent) {
    ctx.sendEvent(
      new AgentRunEvent({
        name: "Analyst",
        text: `Starting analysis`,
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
      } else toolCalls = toolCallResponse.toolCalls;
    }

    // Call the tools
    const toolMsgs = await callTools(
      toolCalls,
      [this.codeInterpreterTool],
      ctx,
      "Analyst",
    );
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }

    return new InputEvent({
      input: this.memory.getMessages(),
    });
  }

  private async handleReportGeneration(
    ctx: HandlerContext<null>,
    ev: ReportGenerationEvent,
  ) {
    const { toolCalls } = ev.data;

    if (!this.documentGeneratorTool) {
      throw new Error("Document generator tool is not available");
    }

    const toolMsgs = await callTools(
      toolCalls,
      [this.documentGeneratorTool],
      ctx,
      "Reporter",
    );
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: this.memory.getMessages() });
  }
}
