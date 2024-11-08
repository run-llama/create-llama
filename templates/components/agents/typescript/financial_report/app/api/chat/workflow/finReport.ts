import {
  Context,
  StartEvent,
  StopEvent,
  Workflow,
  WorkflowEvent,
} from "@llamaindex/core/workflow";
import {
  BaseToolWithCall,
  ChatMemoryBuffer,
  ChatMessage,
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

export class FinancialReportWorkflow extends Workflow {
  llm: ToolCallLLM;
  memory: ChatMemoryBuffer;
  queryEngineTools: BaseToolWithCall[];
  codeInterpreterTool: BaseToolWithCall;
  documentGeneratorTool: BaseToolWithCall;
  systemPrompt?: string;
  writeEvents?: boolean;

  constructor(options: {
    llm?: ToolCallLLM;
    chatHistory: ChatMessage[];
    queryEngineTools: BaseToolWithCall[];
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
    this.queryEngineTools = options.queryEngineTools;
    this.codeInterpreterTool = options.codeInterpreterTool;
    this.documentGeneratorTool = options.documentGeneratorTool;
    this.memory = new ChatMemoryBuffer({
      llm: this.llm,
      chatHistory: options.chatHistory,
    });

    // Add steps
    this.addStep(StartEvent<AgentInput>, this.prepareChatHistory, {
      outputs: InputEvent,
    });
    this.addStep(InputEvent, this.handleLLMInput, {
      outputs: [
        InputEvent,
        ResearchEvent,
        AnalyzeEvent,
        ReportGenerationEvent,
        StopEvent,
      ],
    });
    this.addStep(ResearchEvent, this.handleResearch, {
      outputs: AnalyzeEvent,
    });
    this.addStep(AnalyzeEvent, this.handleAnalyze, {
      outputs: InputEvent,
    });
    this.addStep(ReportGenerationEvent, this.handleReportGeneration, {
      outputs: InputEvent,
    });
  }

  private async prepareChatHistory(ctx: Context, ev: StartEvent<AgentInput>) {
    const message = ev.data.input.message;

    if (this.systemPrompt) {
      this.memory.put({ role: "system", content: this.systemPrompt });
    }
    this.memory.put({ role: "user", content: message });

    return new InputEvent({ input: this.memory.getMessages() });
  }

  private async handleLLMInput(ctx: Context, ev: InputEvent) {
    const chatHistory = ev.data.input;

    const tools = [this.codeInterpreterTool, this.documentGeneratorTool];
    if (this.queryEngineTools) {
      tools.push(...this.queryEngineTools);
    }

    const toolCallResponse = await chatWithTools(this.llm, tools, chatHistory);

    if (!toolCallResponse.isCallingTool()) {
      return new StopEvent({ result: toolCallResponse.responseGenerator });
    }

    if (toolCallResponse.isCallingDifferentTools()) {
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
    switch (toolCallResponse.toolName()) {
      case this.codeInterpreterTool.metadata.name:
        return new AnalyzeEvent({
          input: toolCallResponse.toolCalls,
        });
      case this.documentGeneratorTool.metadata.name:
        return new ReportGenerationEvent({
          toolCalls: toolCallResponse.toolCalls,
        });
      default:
        // IF the tool name start with "retriever", it's a research tool
        if (toolCallResponse.toolName().startsWith("retriever")) {
          return new ResearchEvent({
            toolCalls: toolCallResponse.toolCalls,
          });
        }
        throw new Error(`Unknown tool: ${toolCallResponse.toolName()}`);
    }
  }

  private async handleResearch(ctx: Context, ev: ResearchEvent) {
    ctx.writeEventToStream(
      new AgentRunEvent({
        name: "Researcher",
        text: "Researching data",
        type: "text",
      }),
    );

    const { toolCalls } = ev.data;

    const toolMsgs = await callTools(
      toolCalls,
      this.queryEngineTools,
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
  private async handleAnalyze(ctx: Context, ev: AnalyzeEvent) {
    ctx.writeEventToStream(
      new AgentRunEvent({
        name: "Analyst",
        text: `Starting analysis`,
      }),
    );
    // Request by workflow LLM, input is a list of tool calls
    let toolCalls: ToolCall[] = [];
    if (ev.data.input instanceof Array) {
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

      if (!toolCallResponse.isCallingTool()) {
        this.memory.put({
          role: "assistant",
          content: await toolCallResponse.asFullResponse(),
        });
        return new InputEvent({
          input: this.memory.getMessages(),
        });
      } else toolCalls = toolCallResponse.toolCalls;
    }

    // Call the tools
    console.log("Calling tools", toolCalls);
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
    ctx: Context,
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
