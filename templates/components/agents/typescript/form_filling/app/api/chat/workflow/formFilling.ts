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
You are a helpful assistant who helps fill missing cells in a CSV file.
Only use the information from the retriever tool - don't make up any information yourself. Fill N/A if an answer is not found.
If there is no retriever tool or the gathered information has many N/A values indicating the questions don't match the data, respond with a warning and ask the user to upload a different file or connect to a knowledge base.
You can make multiple tool calls at once but only call with the same tool.
Only use the local file path for the tools.
`;

export class FormFillingWorkflow extends Workflow<
  null,
  AgentInput,
  ChatResponseChunk
> {
  llm: ToolCallLLM;
  memory: ChatMemoryBuffer;
  extractorTool: BaseToolWithCall;
  queryEngineTools?: BaseToolWithCall[];
  fillMissingCellsTool: BaseToolWithCall;
  systemPrompt?: string;

  constructor(options: {
    llm?: ToolCallLLM;
    chatHistory: ChatMessage[];
    extractorTool: BaseToolWithCall;
    queryEngineTools?: BaseToolWithCall[];
    fillMissingCellsTool: BaseToolWithCall;
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
    this.extractorTool = options.extractorTool;
    this.queryEngineTools = options.queryEngineTools;
    this.fillMissingCellsTool = options.fillMissingCellsTool;
    if (!options.fillMissingCellsTool) {
      throw new Error("Fill missing cells tool is required");
    }
    if (!options.extractorTool) {
      throw new Error("Extractor tool is required");
    }

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
          ExtractMissingCellsEvent,
          FindAnswersEvent,
          FillMissingCellsEvent,
          StopEvent,
        ],
      },
      this.handleLLMInput.bind(this),
    );

    this.addStep(
      {
        inputs: [ExtractMissingCellsEvent],
        outputs: [InputEvent],
      },
      this.handleExtractMissingCells.bind(this),
    );

    this.addStep(
      {
        inputs: [FindAnswersEvent],
        outputs: [InputEvent],
      },
      this.handleFindAnswers.bind(this),
    );

    this.addStep(
      {
        inputs: [FillMissingCellsEvent],
        outputs: [InputEvent],
      },
      this.handleFillMissingCells.bind(this),
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

    const tools = [this.extractorTool, this.fillMissingCellsTool];
    if (this.queryEngineTools) {
      tools.push(...this.queryEngineTools);
    }

    const toolCallResponse = await chatWithTools(this.llm, tools, chatHistory);

    if (!toolCallResponse.hasToolCall()) {
      return new StopEvent({ result: toolCallResponse.responseGenerator });
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
      case this.extractorTool.metadata.name:
        return new ExtractMissingCellsEvent({
          toolCalls: toolCallResponse.toolCalls,
        });
      case this.fillMissingCellsTool.metadata.name:
        return new FillMissingCellsEvent({
          toolCalls: toolCallResponse.toolCalls,
        });
      default:
        if (
          this.queryEngineTools &&
          this.queryEngineTools.some((tool) => tool.metadata.name === toolName)
        ) {
          return new FindAnswersEvent({
            toolCalls: toolCallResponse.toolCalls,
          });
        }
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async handleExtractMissingCells(
    ctx: HandlerContext<null>,
    ev: ExtractMissingCellsEvent,
  ) {
    ctx.sendEvent(
      new AgentRunEvent({
        name: "CSVExtractor",
        text: "Extracting missing cells",
        type: "text",
      }),
    );
    const { toolCalls } = ev.data;
    const toolMsgs = await callTools({
      toolCalls,
      tools: [this.extractorTool],
      ctx,
      agentName: "CSVExtractor",
    });
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: this.memory.getMessages() });
  }

  private async handleFindAnswers(
    ctx: HandlerContext<null>,
    ev: FindAnswersEvent,
  ) {
    const { toolCalls } = ev.data;
    if (!this.queryEngineTools) {
      throw new Error("Query engine tool is not available");
    }
    ctx.sendEvent(
      new AgentRunEvent({
        name: "Researcher",
        text: "Finding answers",
        type: "text",
      }),
    );
    const toolMsgs = await callTools({
      toolCalls,
      tools: this.queryEngineTools,
      ctx,
      agentName: "Researcher",
    });

    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: this.memory.getMessages() });
  }

  private async handleFillMissingCells(
    ctx: HandlerContext<null>,
    ev: FillMissingCellsEvent,
  ) {
    const { toolCalls } = ev.data;

    const toolMsgs = await callTools({
      toolCalls,
      tools: [this.fillMissingCellsTool],
      ctx,
      agentName: "Processor",
    });
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: this.memory.getMessages() });
  }
}
