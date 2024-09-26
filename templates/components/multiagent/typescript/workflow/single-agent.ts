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
  Settings,
  ToolCall,
  ToolCallLLM,
  ToolCallLLMMessageOptions,
  callTool,
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
  llm: ToolCallLLM;
  memory: ChatMemoryBuffer;
  tools: BaseToolWithCall[];
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
    return this.memory.getMessages();
  }

  private async prepareChatHistory(
    ctx: Context,
    ev: StartEvent<AgentInput>,
  ): Promise<InputEvent> {
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
    if (ctx.get("streaming")) {
      return await this.handleLLMInputStream(ctx, ev);
    }

    const result = await this.llm.chat({
      messages: this.chatHistory,
      tools: this.tools,
    });
    this.memory.put(result.message);

    const toolCalls = this.getToolCallsFromResponse(result);
    if (toolCalls.length) {
      return new ToolCallEvent({ toolCalls });
    }
    this.writeEvent("Finished task", ctx);
    return new StopEvent({ result: result.message.content.toString() });
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
          role: "assistant",
          content: "",
          options: fullResponse.options,
        });
        yield fullResponse;
      }
    };

    const generator = responseGenerator();
    const isToolCall = await generator.next();
    if (isToolCall.value) {
      const fullResponse = await generator.next();
      const toolCalls = this.getToolCallsFromResponse(
        fullResponse.value as ChatResponseChunk<ToolCallLLMMessageOptions>,
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
    const { toolCalls } = ev.data;

    const toolMsgs: ChatMessage[] = [];

    for (const call of toolCalls) {
      const targetTool = this.tools.find(
        (tool) => tool.metadata.name === call.name,
      );
      // TODO: make logger optional in callTool in framework
      const toolOutput = await callTool(targetTool, call, {
        log: () => {},
        error: console.error.bind(console),
        warn: () => {},
      });
      toolMsgs.push({
        content: JSON.stringify(toolOutput.output),
        role: "user",
        options: {
          toolResult: {
            result: toolOutput.output,
            isError: toolOutput.isError,
            id: call.id,
          },
        },
      });
    }

    for (const msg of toolMsgs) {
      this.memory.put(msg);
    }

    return new InputEvent({ input: this.memory.getMessages() });
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

  private getToolCallsFromResponse(
    response:
      | ChatResponse<ToolCallLLMMessageOptions>
      | ChatResponseChunk<ToolCallLLMMessageOptions>,
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
