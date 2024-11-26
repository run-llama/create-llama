import { HandlerContext } from "@llamaindex/workflow";
import {
  BaseToolWithCall,
  callTool,
  ChatMessage,
  ChatResponse,
  ChatResponseChunk,
  PartialToolCall,
  QueryEngineTool,
  ToolCall,
  ToolCallLLM,
  ToolCallLLMMessageOptions,
} from "llamaindex";
import crypto from "node:crypto";
import { getDataSource } from "../engine";
import { createQueryEngineTool } from "../engine/tools/query-engine";
import { AgentRunEvent } from "./type";

export const getQueryEngineTool = async (): Promise<QueryEngineTool | null> => {
  const index = await getDataSource();

  if (!index) {
    return null;
  }

  return createQueryEngineTool(index);
};

/**
 * Call multiple tools and return the tool messages
 */
export const callTools = async <T>({
  tools,
  toolCalls,
  ctx,
  agentName,
  writeEvent = true,
}: {
  toolCalls: ToolCall[];
  tools: BaseToolWithCall[];
  ctx: HandlerContext<T>;
  agentName: string;
  writeEvent?: boolean;
}): Promise<ChatMessage[]> => {
  const toolMsgs: ChatMessage[] = [];
  if (toolCalls.length === 0) {
    return toolMsgs;
  }
  if (toolCalls.length === 1) {
    const tool = tools.find((tool) => tool.metadata.name === toolCalls[0].name);
    if (!tool) {
      throw new Error(`Tool ${toolCalls[0].name} not found`);
    }
    return [
      await callSingleTool(
        tool,
        toolCalls[0],
        writeEvent
          ? (msg: string) => {
              ctx.sendEvent(
                new AgentRunEvent({
                  agent: agentName,
                  text: msg,
                  type: "text",
                }),
              );
            }
          : undefined,
      ),
    ];
  }
  // Multiple tool calls, show events in progress
  const progressId = crypto.randomUUID();
  const totalSteps = toolCalls.length;
  let currentStep = 0;
  for (const toolCall of toolCalls) {
    const tool = tools.find((tool) => tool.metadata.name === toolCall.name);
    if (!tool) {
      throw new Error(`Tool ${toolCall.name} not found`);
    }
    const toolMsg = await callSingleTool(tool, toolCall, (msg: string) => {
      ctx.sendEvent(
        new AgentRunEvent({
          agent: agentName,
          text: msg,
          type: "progress",
          data: {
            id: progressId,
            total: totalSteps,
            current: currentStep,
          },
        }),
      );
      currentStep++;
    });
    toolMsgs.push(toolMsg);
  }
  return toolMsgs;
};

export const callSingleTool = async (
  tool: BaseToolWithCall,
  toolCall: ToolCall,
  eventEmitter?: (msg: string) => void,
): Promise<ChatMessage> => {
  if (eventEmitter) {
    eventEmitter(
      `Calling tool ${toolCall.name} with input: ${JSON.stringify(toolCall.input)}`,
    );
  }

  const toolOutput = await callTool(tool, toolCall, {
    log: () => {},
    error: (...args: unknown[]) => {
      console.error(`Tool ${toolCall.name} got error:`, ...args);
      if (eventEmitter) {
        eventEmitter(`Tool ${toolCall.name} got error: ${args.join(" ")}`);
      }
      return {
        content: JSON.stringify({
          error: args.join(" "),
        }),
        role: "user",
        options: {
          toolResult: {
            id: toolCall.id,
            result: JSON.stringify({
              error: args.join(" "),
            }),
            isError: true,
          },
        },
      };
    },
    warn: () => {},
  });

  return {
    content: JSON.stringify(toolOutput.output),
    role: "user",
    options: {
      toolResult: {
        result: toolOutput.output,
        isError: toolOutput.isError,
        id: toolCall.id,
      },
    },
  };
};

class ChatWithToolsResponse {
  toolCalls: ToolCall[];
  toolCallMessage?: ChatMessage;
  responseGenerator?: AsyncGenerator<ChatResponseChunk>;

  constructor(options: {
    toolCalls: ToolCall[];
    toolCallMessage?: ChatMessage;
    responseGenerator?: AsyncGenerator<ChatResponseChunk>;
  }) {
    this.toolCalls = options.toolCalls;
    this.toolCallMessage = options.toolCallMessage;
    this.responseGenerator = options.responseGenerator;
  }

  hasMultipleTools() {
    const uniqueToolNames = new Set(this.getToolNames());
    return uniqueToolNames.size > 1;
  }

  hasToolCall() {
    return this.toolCalls.length > 0;
  }

  getToolNames() {
    return this.toolCalls.map((toolCall) => toolCall.name);
  }

  async asFullResponse(): Promise<ChatMessage> {
    if (!this.responseGenerator) {
      throw new Error("No response generator");
    }
    let fullResponse = "";
    for await (const chunk of this.responseGenerator) {
      fullResponse += chunk.delta;
    }
    return {
      role: "assistant",
      content: fullResponse,
    };
  }
}

export const chatWithTools = async (
  llm: ToolCallLLM,
  tools: BaseToolWithCall[],
  messages: ChatMessage[],
): Promise<ChatWithToolsResponse> => {
  const responseGenerator = async function* (): AsyncGenerator<
    boolean | ChatResponseChunk,
    void,
    unknown
  > {
    const responseStream = await llm.chat({ messages, tools, stream: true });

    let fullResponse = null;
    let yieldedIndicator = false;
    const toolCallMap = new Map();
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

      if (chunk.options && "toolCall" in chunk.options) {
        for (const toolCall of chunk.options.toolCall as PartialToolCall[]) {
          if (toolCall.id) {
            toolCallMap.set(toolCall.id, toolCall);
          }
        }
      }

      if (
        hasToolCalls &&
        (chunk.raw as any)?.choices?.[0]?.finish_reason !== null
      ) {
        // Update the fullResponse with the tool calls
        const toolCalls = Array.from(toolCallMap.values());
        fullResponse = {
          ...chunk,
          options: {
            ...chunk.options,
            toolCall: toolCalls,
          },
        };
      }
    }

    if (fullResponse) {
      yield fullResponse;
    }
  };

  const generator = responseGenerator();
  const isToolCall = await generator.next();

  if (isToolCall.value) {
    // If it's a tool call, we need to wait for the full response
    let fullResponse = null;
    for await (const chunk of generator) {
      fullResponse = chunk;
    }

    if (fullResponse) {
      const responseChunk = fullResponse as ChatResponseChunk;
      const toolCalls = getToolCallsFromResponse(responseChunk);
      return new ChatWithToolsResponse({
        toolCalls,
        toolCallMessage: {
          options: responseChunk.options,
          role: "assistant",
          content: "",
        },
      });
    } else {
      throw new Error("Cannot get tool calls from response");
    }
  }

  return new ChatWithToolsResponse({
    toolCalls: [],
    responseGenerator: generator as AsyncGenerator<ChatResponseChunk>,
  });
};

export const getToolCallsFromResponse = (
  response:
    | ChatResponse<ToolCallLLMMessageOptions>
    | ChatResponseChunk<ToolCallLLMMessageOptions>,
): ToolCall[] => {
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
};
