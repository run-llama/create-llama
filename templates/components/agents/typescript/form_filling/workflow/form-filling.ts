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
  queryEngineTool?: BaseToolWithCall;
  fillMissingCellsTool: BaseToolWithCall;
  systemPrompt?: string;

  constructor(options: {
    llm?: ToolCallLLM;
    chatHistory: ChatMessage[];
    extractorTool: BaseToolWithCall;
    queryEngineTool?: BaseToolWithCall;
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
    this.queryEngineTool = options.queryEngineTool;
    this.fillMissingCellsTool = options.fillMissingCellsTool;

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
          ExtractMissingCellsEvent,
          FindAnswersEvent,
          FillMissingCellsEvent,
          StopEvent,
        ],
      },
      this.handleLLMInput,
    );

    this.addStep(
      {
        inputs: [ExtractMissingCellsEvent],
        outputs: [InputEvent],
      },
      this.handleExtractMissingCells,
    );

    this.addStep(
      {
        inputs: [FindAnswersEvent],
        outputs: [InputEvent],
      },
      this.handleFindAnswers,
    );

    this.addStep(
      {
        inputs: [FillMissingCellsEvent],
        outputs: [InputEvent],
      },
      this.handleFillMissingCells,
    );
  }

  prepareChatHistory = async (
    ctx: HandlerContext<null>,
    ev: StartEvent<AgentInput>,
  ): Promise<InputEvent> => {
    const { userInput, chatHistory } = ev.data;

    if (this.systemPrompt) {
      this.memory.put({ role: "system", content: this.systemPrompt });
    }
    this.memory.put({ role: "user", content: userInput });

    return new InputEvent({ input: await this.memory.getMessages() });
  };

  handleLLMInput = async (
    ctx: HandlerContext<null>,
    ev: InputEvent,
  ): Promise<
    | InputEvent
    | ExtractMissingCellsEvent
    | FindAnswersEvent
    | FillMissingCellsEvent
    | StopEvent
  > => {
    const chatHistory = ev.data.input;

    const tools = [this.extractorTool, this.fillMissingCellsTool];
    if (this.queryEngineTool) {
      tools.push(this.queryEngineTool);
    }

    const toolCallResponse = await chatWithTools(this.llm, tools, chatHistory);

    if (!toolCallResponse.hasToolCall()) {
      return new StopEvent(toolCallResponse.responseGenerator as any);
    }

    if (toolCallResponse.hasMultipleTools()) {
      this.memory.put({
        role: "assistant",
        content:
          "Calling different tools is not allowed. Please only use multiple calls of the same tool.",
      });
      return new InputEvent({ input: await this.memory.getMessages() });
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
          this.queryEngineTool &&
          this.queryEngineTool.metadata.name === toolName
        ) {
          return new FindAnswersEvent({
            toolCalls: toolCallResponse.toolCalls,
          });
        }
        throw new Error(`Unknown tool: ${toolName}`);
    }
  };

  handleExtractMissingCells = async (
    ctx: HandlerContext<null>,
    ev: ExtractMissingCellsEvent,
  ): Promise<InputEvent> => {
    ctx.sendEvent(
      new AgentRunEvent({
        agent: "CSVExtractor",
        text: "Extracting missing cells",
        type: "text",
      }),
    );
    const { toolCalls } = ev.data;
    const toolMsgs = await callTools({
      tools: [this.extractorTool],
      toolCalls,
      ctx,
      agentName: "CSVExtractor",
    });
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: await this.memory.getMessages() });
  };

  handleFindAnswers = async (
    ctx: HandlerContext<null>,
    ev: FindAnswersEvent,
  ): Promise<InputEvent> => {
    const { toolCalls } = ev.data;
    if (!this.queryEngineTool) {
      throw new Error("Query engine tool is not available");
    }
    ctx.sendEvent(
      new AgentRunEvent({
        agent: "Researcher",
        text: "Finding answers",
        type: "text",
      }),
    );
    const toolMsgs = await callTools({
      tools: [this.queryEngineTool],
      toolCalls,
      ctx,
      agentName: "Researcher",
    });

    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: await this.memory.getMessages() });
  };

  handleFillMissingCells = async (
    ctx: HandlerContext<null>,
    ev: FillMissingCellsEvent,
  ): Promise<InputEvent> => {
    const { toolCalls } = ev.data;

    const toolMsgs = await callTools({
      tools: [this.fillMissingCellsTool],
      toolCalls,
      ctx,
      agentName: "Processor",
    });
    for (const toolMsg of toolMsgs) {
      this.memory.put(toolMsg);
    }
    return new InputEvent({ input: await this.memory.getMessages() });
  };
}
