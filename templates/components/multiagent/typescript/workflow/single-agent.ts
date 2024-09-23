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
  ChatResponse,
  ChatResponseChunk,
  LLM,
  Settings,
  ToolCall,
  ToolCallLLM,
} from "llamaindex";
import { AgentInput, AgentRunEvent } from "./type";

class InputEvent extends WorkflowEvent<{
  input: ChatMessage[];
}> {}

class ToolCallEvent extends WorkflowEvent<{
  toolCalls: ToolCall[];
}> {}

export class FunctionCallingAgent extends Workflow {
  name: string;
  llm: LLM;
  memory: ChatMemoryBuffer;
  tools: BaseToolWithCall[];
  systemPrompt?: string;
  writeEvents: boolean;
  role?: string;
  toolCalled: boolean = false;

  constructor(options: {
    name: string;
    llm?: LLM;
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
    this.llm = options.llm ?? Settings.llm;
    this.checkToolCallSupport();
    this.memory = new ChatMemoryBuffer({
      llm: this.llm,
      chatHistory: options.chatHistory,
    });
    this.tools = options?.tools ?? [];
    this.systemPrompt = options.systemPrompt;
    this.writeEvents = options?.writeEvents ?? true;
    this.role = options?.role;

    // add steps
    this.addStep(StartEvent<AgentInput>, this.prepareChatHistory, {
      outputs: InputEvent,
    });
    this.addStep(InputEvent, this.handleLLMInput, {
      outputs: [ToolCallEvent, StopEvent],
    });
    this.addStep(ToolCallEvent, this.handleToolCalls, {
      outputs: InputEvent,
    });
  }

  private get chatHistory() {
    return this.memory.getAllMessages();
  }

  private get toolsByName() {
    return this.tools.reduce((acc: Record<string, BaseToolWithCall>, tool) => {
      acc[tool.metadata.name] = tool;
      return acc;
    }, {});
  }

  private async prepareChatHistory(
    ctx: Context,
    ev: StartEvent<AgentInput>,
  ): Promise<InputEvent> {
    this.toolCalled = false;
    const { message, streaming } = ev.data.input;
    ctx.set("streaming", streaming);
    this.writeEvent(`Start to work on: ${message}`, ctx);
    if (this.systemPrompt) {
      this.memory.put({ role: "system", content: this.systemPrompt });
    }
    this.memory.put({ role: "user", content: message });
    return new InputEvent({ input: this.chatHistory });
  }

  private async handleLLMInput(
    ctx: Context,
    ev: InputEvent,
  ): Promise<StopEvent<string | AsyncGenerator> | ToolCallEvent> {
    const isStreaming = ctx.get("streaming");
    const llmArgs = { messages: this.chatHistory, tools: this.tools };

    if (isStreaming) {
      return await this.handleLLMInputStream(ctx, ev);
    }

    const nonStreamingRes = await this.llm.chat({ ...llmArgs });
    const toolCalls = this.getToolCallsFromResponse(nonStreamingRes);
    if (toolCalls.length && !this.toolCalled) {
      return new ToolCallEvent({ toolCalls });
    }
    this.writeEvent("Finished task", ctx);
    const result = nonStreamingRes.message.content.toString();
    return new StopEvent({ result });
  }

  private async handleLLMInputStream(
    context: Context,
    ev: InputEvent,
  ): Promise<StopEvent<AsyncGenerator> | ToolCallEvent> {
    const { llm, tools, memory } = this;
    const llmArgs = { messages: this.chatHistory, tools };

    const responseGenerator = async function* () {
      const responseStream = await llm.chat({ ...llmArgs, stream: true });

      let fullResponse = null;
      let yieldedIndicator = false;
      for await (const chunk of responseStream) {
        const hasToolCalls = chunk.options && "toolCall" in chunk.options;
        if (!hasToolCalls) {
          if (!yieldedIndicator) {
            yield false;
            yieldedIndicator = true;
          }
          yield chunk;
        } else if (!yieldedIndicator) {
          yield true;
          yieldedIndicator = true;
        }

        fullResponse = chunk;
      }

      if (fullResponse) {
        memory.put({
          role: "system",
          content: fullResponse.delta,
        });
        yield fullResponse;
      }
    };

    const generator = responseGenerator();
    const isToolCall = await generator.next();
    if (isToolCall.value) {
      const fullResponse = await generator.next();
      const toolCalls = this.getToolCallsFromResponse(
        fullResponse.value as ChatResponseChunk<object>,
      );
      return new ToolCallEvent({ toolCalls });
    }

    this.writeEvent("Finished task", context);
    return new StopEvent({ result: generator });
  }

  private async handleToolCalls(
    ctx: Context,
    ev: ToolCallEvent,
  ): Promise<InputEvent> {
    this.toolCalled = true;
    const { toolCalls } = ev.data;

    const toolMsgs: ChatMessage[] = [];
    for (const toolCall of toolCalls) {
      const tool = this.toolsByName[toolCall.name];
      const options = {
        tool_call_id: toolCall.id,
        name: tool.metadata.name,
      };
      if (!tool) {
        toolMsgs.push({
          role: "system",
          content: `Tool ${toolCall.name} does not exist`,
          options,
        });
        continue;
      }

      try {
        const toolInput = JSON.parse(toolCall.input.toString());
        const toolOutput = await tool.call(toolInput);
        toolMsgs.push({
          role: "system",
          content: toolOutput.toString(),
          options,
        });
      } catch (e) {
        console.error(e);
        toolMsgs.push({
          role: "system",
          content: `Encountered error in tool call: ${e}`,
          options,
        });
      }
    }

    for (const msg of toolMsgs) {
      this.memory.put(msg);
    }

    return new InputEvent({ input: this.memory.getAllMessages() });
  }

  private writeEvent(msg: string, context: Context) {
    if (!this.writeEvents) return;
    context.writeEventToStream({
      data: new AgentRunEvent({ name: this.name, msg }),
    });
  }

  private checkToolCallSupport() {
    const { supportToolCall } = this.llm as ToolCallLLM;
    if (!supportToolCall) throw new Error("LLM does not support tool calls");
  }

  // TODO: in LITS, llm should have a method to get tool calls from response
  // then we don't need to use toolCalled flag
  private getToolCallsFromResponse(
    response: ChatResponse<object> | ChatResponseChunk<object>,
  ): ToolCall[] {
    let options;
    if ("message" in response) {
      options = response.message.options;
    } else {
      options = response.options;
    }
    if (options && "toolCall" in options) {
      return options.toolCall as ToolCall[];
    }
    return [];
  }
}
