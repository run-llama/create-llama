import {
  Context,
  StartEvent,
  StopEvent,
  Workflow,
  WorkflowEvent,
} from "@llamaindex/core/workflow";
import {
  BaseTool,
  ChatMemoryBuffer,
  ChatMessage,
  ChatResponse,
  LLM,
  Settings,
  ToolCall,
  ToolOutput,
} from "llamaindex";

export class InputEvent extends WorkflowEvent<{
  input: ChatMessage[];
}> {}

export class ToolCallEvent extends WorkflowEvent<{
  tool_calls: ToolCall[];
}> {}

export class AgentRunEvent extends WorkflowEvent<{
  name: string;
  msg: string;
}> {}

export class MessageEvent extends WorkflowEvent<{ msg: string }> {}

export class AgentRunResult {
  constructor(
    public response: ChatResponse,
    public sources: ToolOutput[],
  ) {}
}

export class FunctionCallingAgent extends Workflow {
  tools: BaseTool[];
  name: string;
  writeEvents: boolean;
  role?: string;
  llm: LLM;
  systemPrompt?: string;
  memory: ChatMemoryBuffer;
  sources: ToolOutput[];

  constructor(options: {
    name: string;
    llm?: LLM;
    chatHistory?: ChatMessage[];
    tools?: BaseTool[];
    systemPrompt?: string;
    verbose?: boolean;
    timeout?: number;
    writeEvents?: boolean;
    role?: string;
  }) {
    super({
      verbose: options?.verbose ?? false,
      timeout: options?.timeout ?? 360,
    });
    this.tools = options?.tools ?? [];
    this.name = options?.name;
    this.writeEvents = options?.writeEvents ?? true;
    this.role = options?.role;
    this.llm = options.llm ?? Settings.llm;
    this.systemPrompt = options.systemPrompt;
    this.memory = new ChatMemoryBuffer({
      llm: this.llm,
      chatHistory: options.chatHistory,
    });
    this.sources = [];
    this.addStep(StartEvent, this.prepareChatHistory, {
      outputs: InputEvent,
    });
    this.addStep(InputEvent, this.handleLLMInput, {
      outputs: [ToolCallEvent, StopEvent],
    });
    this.addStep(ToolCallEvent, this.handleToolCalls, {
      outputs: InputEvent,
    });
  }

  get steps() {
    return [
      {
        step: StartEvent,
        handler: () => this.prepareChatHistory,
        params: { outputs: InputEvent },
      },
      {
        step: InputEvent,
        handler: this.handleLLMInput,
        params: { outputs: [ToolCallEvent, StopEvent] },
      },
      {
        step: ToolCallEvent,
        handler: this.handleToolCalls,
        params: { outputs: InputEvent },
      },
    ];
  }

  async prepareChatHistory(ctx: Context, ev: StartEvent): Promise<InputEvent> {
    throw new Error("Method not implemented.");
  }

  async handleLLMInput(
    ctx: Context,
    ev: InputEvent,
  ): Promise<ToolCallEvent | StopEvent> {
    throw new Error("Method not implemented.");
  }

  async handleToolCalls(ctx: Context, ev: ToolCallEvent): Promise<InputEvent> {
    throw new Error("Method not implemented.");
  }
}
