import {
  Context,
  StartEvent,
  StopEvent,
  Workflow,
  WorkflowEvent,
} from "@llamaindex/core/workflow";
import { StreamData } from "ai";
import {
  BaseToolWithCall,
  CallbackManager,
  ChatMemoryBuffer,
  ChatMessage,
  EngineResponse,
  LLM,
  OpenAIAgent,
  Settings,
} from "llamaindex";
import { AgentInput, FunctionCallingStreamResult } from "./type";

class InputEvent extends WorkflowEvent<{
  input: ChatMessage[];
}> {}

export class FunctionCallingAgent extends Workflow {
  name: string;
  llm: LLM;
  memory: ChatMemoryBuffer;
  tools: BaseToolWithCall[];
  systemPrompt?: string;
  writeEvents: boolean;
  role?: string;
  callbackManager: CallbackManager;
  stream: StreamData;

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
    stream: StreamData;
  }) {
    super({
      verbose: options?.verbose ?? false,
      timeout: options?.timeout ?? 360,
    });
    this.name = options?.name;
    this.llm = options.llm ?? Settings.llm;
    this.memory = new ChatMemoryBuffer({
      llm: this.llm,
      chatHistory: options.chatHistory,
    });
    this.tools = options?.tools ?? [];
    this.systemPrompt = options.systemPrompt;
    this.writeEvents = options?.writeEvents ?? true;
    this.role = options?.role;
    this.callbackManager = this.createCallbackManager();
    this.stream = options.stream;

    // add steps
    this.addStep(StartEvent<AgentInput>, this.prepareChatHistory, {
      outputs: InputEvent,
    });
    this.addStep(InputEvent, this.handleLLMInput, {
      outputs: StopEvent,
    });
  }

  private get chatHistory() {
    return this.memory.getAllMessages();
  }

  private async prepareChatHistory(
    ctx: Context,
    ev: StartEvent<AgentInput>,
  ): Promise<InputEvent> {
    const { message, streaming } = ev.data.input;
    ctx.set("streaming", streaming);
    this.writeEvent(`Start to work on: ${message}`);
    if (this.systemPrompt) {
      this.memory.put({ role: "system", content: this.systemPrompt });
    }
    this.memory.put({ role: "user", content: message });
    return new InputEvent({ input: this.chatHistory });
  }

  private async handleLLMInput(
    ctx: Context,
    ev: InputEvent,
  ): Promise<StopEvent<string | ReadableStream<EngineResponse>>> {
    const chatEngine = new OpenAIAgent({
      tools: this.tools,
      systemPrompt: this.systemPrompt,
      chatHistory: this.chatHistory,
    });

    if (!ctx.get("streaming")) {
      const response = await Settings.withCallbackManager(
        this.callbackManager,
        () => {
          return chatEngine.chat({
            message: ev.data.input.pop()!.content,
          });
        },
      );
      this.writeEvent("Finished task");
      return new StopEvent({ result: response.message.content.toString() });
    }

    const response = await Settings.withCallbackManager(
      this.callbackManager,
      () => {
        return chatEngine.chat({
          message: ev.data.input.pop()!.content,
          stream: true,
        });
      },
    );
    ctx.writeEventToStream({ data: new FunctionCallingStreamResult(response) });
    return new StopEvent({ result: response });
  }

  private createCallbackManager() {
    const callbackManager = new CallbackManager();
    callbackManager.on("llm-tool-call", (event) => {
      const { toolCall } = event.detail;
      this.writeEvent(
        `Calling tool "${toolCall.name}" with input: ${JSON.stringify(toolCall.input)}`,
      );
    });
    callbackManager.on("llm-tool-result", (event) => {
      const { toolCall, toolResult } = event.detail;
      this.writeEvent(
        `Getting result from tool "${toolCall.name}": \n${JSON.stringify(toolResult.output)}`,
      );
    });
    return callbackManager;
  }

  private writeEvent(msg: string) {
    if (!this.writeEvents) return;
    this.stream.appendMessageAnnotation({
      type: "agent",
      data: { agent: this.name, text: msg },
    });
  }
}
