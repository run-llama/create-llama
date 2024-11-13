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
  QueryEngineTool,
  Settings,
  ToolCall,
  ToolCallLLM,
} from "llamaindex";
import { callTools, chatWithTools } from "./tools";
import { AgentInput, AgentRunEvent } from "./type";

class InputEvent extends WorkflowEvent<{
  input: ChatMessage[];
}> {}

class ToolCallEvent extends WorkflowEvent<{
  toolCalls: ToolCall[];
}> {}

type FunctionCallingAgentContextData = {
  streaming: boolean;
};

export type FunctionCallingAgentInput = AgentInput & {
  displayName: string;
};

export class FunctionCallingAgent extends Workflow<
  FunctionCallingAgentContextData,
  FunctionCallingAgentInput,
  string | AsyncGenerator<boolean | ChatResponseChunk<object>>
> {
  name: string;
  llm: ToolCallLLM;
  memory: ChatMemoryBuffer;
  tools: BaseToolWithCall[] | QueryEngineTool[];
  systemPrompt?: string;
  writeEvents: boolean;
  role?: string;

  constructor(options: {
    name: string;
    llm?: ToolCallLLM;
    chatHistory?: ChatMessage[];
    tools?: BaseToolWithCall[];
    systemPrompt?: string;
    writeEvents?: boolean;
    role?: string;
    verbose?: boolean;
    timeout?: number;
  }) {
    super({
      verbose: options?.verbose ?? false,
      timeout: options?.timeout ?? 360,
    });
    this.name = options?.name;
    this.llm = options.llm ?? (Settings.llm as ToolCallLLM);
    if (!(this.llm instanceof ToolCallLLM)) {
      throw new Error("LLM is not a ToolCallLLM");
    }
    this.memory = new ChatMemoryBuffer({
      llm: this.llm,
      chatHistory: options.chatHistory,
    });
    this.tools = options?.tools ?? [];
    this.systemPrompt = options.systemPrompt;
    this.writeEvents = options?.writeEvents ?? true;
    this.role = options?.role;

    // add steps
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
        outputs: [ToolCallEvent, StopEvent],
      },
      this.handleLLMInput,
    );
    this.addStep(
      {
        inputs: [ToolCallEvent],
        outputs: [InputEvent],
      },
      this.handleToolCalls,
    );
  }

  private get chatHistory() {
    return this.memory.getMessages();
  }

  prepareChatHistory = async (
    ctx: HandlerContext<FunctionCallingAgentContextData>,
    ev: StartEvent<AgentInput>,
  ): Promise<InputEvent> => {
    const { message, streaming } = ev.data;
    ctx.data.streaming = streaming ?? false;
    this.writeEvent(`Start to work on: ${message}`, ctx);
    if (this.systemPrompt) {
      this.memory.put({ role: "system", content: this.systemPrompt });
    }
    this.memory.put({ role: "user", content: message });
    return new InputEvent({ input: this.chatHistory });
  };

  handleLLMInput = async (
    ctx: HandlerContext<FunctionCallingAgentContextData>,
    ev: InputEvent,
  ): Promise<StopEvent<string | AsyncGenerator> | ToolCallEvent> => {
    const toolCallResponse = await chatWithTools(
      this.llm,
      this.tools,
      this.chatHistory,
    );
    if (toolCallResponse.toolCallMessage) {
      this.memory.put(toolCallResponse.toolCallMessage);
    }

    if (toolCallResponse.hasToolCall()) {
      return new ToolCallEvent({ toolCalls: toolCallResponse.toolCalls });
    }

    if (ctx.data.streaming) {
      if (!toolCallResponse.responseGenerator) {
        throw new Error("No streaming response");
      }
      return new StopEvent(toolCallResponse.responseGenerator);
    }

    const fullResponse = await toolCallResponse.asFullResponse();
    this.memory.put(fullResponse);
    return new StopEvent(fullResponse.content.toString());
  };

  handleToolCalls = async (
    ctx: HandlerContext<FunctionCallingAgentContextData>,
    ev: ToolCallEvent,
  ): Promise<InputEvent> => {
    const { toolCalls } = ev.data;

    const toolMsgs = await callTools({
      tools: this.tools,
      toolCalls,
      ctx,
      agentName: this.name,
    });

    for (const msg of toolMsgs) {
      this.memory.put(msg);
    }

    return new InputEvent({ input: this.memory.getMessages() });
  };

  writeEvent = (
    msg: string,
    ctx: HandlerContext<FunctionCallingAgentContextData>,
  ) => {
    if (!this.writeEvents) return;
    ctx.sendEvent(
      new AgentRunEvent({ agent: this.name, text: msg, type: "text" }),
    );
  };
}
