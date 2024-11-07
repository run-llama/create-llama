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

class ExtractMissingCellsEvent extends WorkflowEvent<{
  toolCalls: ToolCall[];
}> {}

class FindAnswersEvent extends WorkflowEvent<{
  toolCalls: ToolCall[];
}> {}

class FillMissingCellsEvent extends WorkflowEvent<{
  toolCalls: ToolCall[];
}> {}

const DEFAULT_SYSTEM_PROMPT = `
You are a helpful assistant who helps fill missing cells in a CSV file. Only use the local file path for the tools.
Only use provided data - never make up any information yourself. Fill N/A if an answer is not found.
If there is no query engine tool or the gathered information has many N/A values indicating the questions don't match the data, respond with a warning and ask the user to upload a different file or connect to a knowledge base.
You can make multiple tool calls at once but only call with the same tool.
`;

export class FormFillingWorkflow extends Workflow {
  llm: ToolCallLLM;
  memory: ChatMemoryBuffer;
  extractorTool: BaseToolWithCall;
  queryEngineTool?: BaseToolWithCall;
  fillMissingCellsTool: BaseToolWithCall;
  systemPrompt?: string;
  writeEvents?: boolean;

  constructor(options: {
    llm?: ToolCallLLM;
    chatHistory: ChatMessage[];
    extractorTool: BaseToolWithCall;
    queryEngineTool?: BaseToolWithCall;
    fillMissingCellsTool: BaseToolWithCall;
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
    this.extractorTool = options.extractorTool;
    this.queryEngineTool = options.queryEngineTool;
    this.fillMissingCellsTool = options.fillMissingCellsTool;
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
        ExtractMissingCellsEvent,
        FindAnswersEvent,
        FillMissingCellsEvent,
        StopEvent,
      ],
    });
    this.addStep(ExtractMissingCellsEvent, this.handleExtractMissingCells, {
      outputs: InputEvent,
    });
    this.addStep(FindAnswersEvent, this.handleFindAnswers, {
      outputs: InputEvent,
    });
    this.addStep(FillMissingCellsEvent, this.handleFillMissingCells, {
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

    const tools = [this.extractorTool, this.fillMissingCellsTool];
    if (this.queryEngineTool) {
      tools.push(this.queryEngineTool);
    }

    const toolCallResponse = await chatWithTools(this.llm, tools, chatHistory);

    if (!toolCallResponse.isCallingTool()) {
      this.memory.put({
        role: "assistant",
        content:
          "Calling different tool is not allowed. Please only call one tool at a time.",
      });
      return new StopEvent({ result: toolCallResponse.responseGenerator });
    }

    // Put the LLM tool call message into the memory
    // And trigger the next step according to the tool call
    if (toolCallResponse.toolCallMessage) {
      this.memory.put(toolCallResponse.toolCallMessage);
    }
    switch (toolCallResponse.toolName()) {
      case this.extractorTool.metadata.name:
        return new ExtractMissingCellsEvent({
          toolCalls: toolCallResponse.toolCalls,
        });
      case this.fillMissingCellsTool.metadata.name:
        return new FillMissingCellsEvent({
          toolCalls: toolCallResponse.toolCalls,
        });
      case this.queryEngineTool?.metadata.name:
        return new FindAnswersEvent({
          toolCalls: toolCallResponse.toolCalls,
        });
    }
  }

  private async handleExtractMissingCells(
    ctx: Context,
    ev: ExtractMissingCellsEvent,
  ) {
    ctx.writeEventToStream(
      new AgentRunEvent({
        name: "CSVExtractor",
        text: "Extracting missing cells",
        type: "text",
      }),
    );
    const { toolCalls } = ev.data;
    const toolMsgs = await callTools(
      toolCalls,
      [this.extractorTool],
      ctx,
      "CSVExtractor",
    );
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: this.memory.getMessages() });
  }

  private async handleFindAnswers(ctx: Context, ev: FindAnswersEvent) {
    const { toolCalls } = ev.data;
    if (!this.queryEngineTool) {
      throw new Error("Query engine tool is not available");
    }
    const toolMsgs = await callTools(
      toolCalls,
      [this.queryEngineTool],
      ctx,
      "Researcher",
    );
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: this.memory.getMessages() });
  }

  private async handleFillMissingCells(
    ctx: Context,
    ev: FillMissingCellsEvent,
  ) {
    const { toolCalls } = ev.data;

    if (!this.fillMissingCellsTool) {
      throw new Error("Fill missing cells tool is not available");
    }

    const toolMsgs = await callTools(
      toolCalls,
      [this.fillMissingCellsTool],
      ctx,
      "Processor",
    );
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: this.memory.getMessages() });
  }
}
