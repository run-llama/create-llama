import { Context } from "@llamaindex/core/workflow";
import fs from "fs/promises";
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
import path from "path";
import { getDataSource } from "../engine";
import { createTools } from "../engine/tools/index";
import { AgentRunEvent } from "./type";

export const getQueryEngineTool = async (
  params?: any,
): Promise<QueryEngineTool | null> => {
  const topK = process.env.TOP_K ? parseInt(process.env.TOP_K) : undefined;

  const index = await getDataSource(params);
  if (!index) {
    return null;
  }
  return new QueryEngineTool({
    queryEngine: (index as any).asQueryEngine({
      similarityTopK: topK,
    }),
    metadata: {
      name: "retriever",
      description: `Use this tool to retrieve information about the provided data.`,
    },
  });
};

export const getAvailableTools = async () => {
  const configFile = path.join("config", "tools.json");
  let toolConfig: any;
  const tools: BaseToolWithCall[] = [];
  try {
    toolConfig = JSON.parse(await fs.readFile(configFile, "utf8"));
  } catch (e) {
    console.info(`Could not read ${configFile} file. Using no tools.`);
  }
  if (toolConfig) {
    tools.push(...(await createTools(toolConfig)));
  }
  const queryEngineTool = await getQueryEngineTool();
  if (queryEngineTool) {
    tools.push(queryEngineTool);
  }

  return tools;
};

export const lookupTools = async (
  toolNames: string[],
): Promise<BaseToolWithCall[]> => {
  const availableTools = await getAvailableTools();
  return availableTools.filter((tool) =>
    toolNames.includes(tool.metadata.name),
  );
};

/**
 * Call multiple tools and return the tool messages
 */
export const callTools = async (
  toolCalls: ToolCall[],
  tools: BaseToolWithCall[],
  ctx: Context,
  agentName: string,
  writeEvent: boolean = true,
  // eslint-disable-next-line max-params
): Promise<ChatMessage[]> => {
  const toolMsgs: ChatMessage[] = [];
  if (toolCalls.length === 0) {
    return toolMsgs;
  }
  if (toolCalls.length === 1) {
    return [
      (await callSingleTool(toolCalls[0], tools[0], (msg: string) => {
        if (writeEvent) {
          ctx.writeEventToStream(
            new AgentRunEvent({
              name: agentName,
              text: msg,
              type: "text",
            }),
          );
        }
      })) as ChatMessage,
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
    const toolMsg = await callSingleTool(toolCall, tool, (msg: string) => {
      ctx.writeEventToStream(
        new AgentRunEvent({
          name: agentName,
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
    toolMsgs.push(toolMsg as ChatMessage);
  }
  return toolMsgs;
};

export const callSingleTool = async (
  toolCall: ToolCall,
  tool: BaseToolWithCall,
  eventEmitter: (msg: string) => void,
) => {
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
  responseGenerator?: AsyncGenerator<ChatMessage>;

  constructor(options: {
    toolCalls: ToolCall[];
    toolCallMessage?: ChatMessage;
    responseGenerator?: AsyncGenerator<ChatMessage>;
  }) {
    this.toolCalls = options.toolCalls;
    this.toolCallMessage = options.toolCallMessage;
    this.responseGenerator = options.responseGenerator;
  }

  isCallingDifferentTools() {
    // toolCalls is have different tool names
    const toolNames = this.toolCalls.map((toolCall) => toolCall.name);
    const uniqueToolNames = new Set(toolNames);
    return uniqueToolNames.size > 1;
  }

  isCallingTool() {
    return this.toolCalls.length > 0;
  }

  toolName() {
    return this.toolCalls[0].name;
  }

  async asFullResponse() {
    if (!this.responseGenerator) {
      throw new Error("No response generator");
    }
    let fullResponse = "";
    for await (const chunk of this.responseGenerator) {
      fullResponse += chunk.content;
    }
    return fullResponse;
  }
}

export const chatWithTools = async (
  llm: ToolCallLLM,
  tools: BaseToolWithCall[],
  messages: ChatMessage[],
) => {
  const responseGenerator = async function* () {
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
        } as ChatResponseChunk<ToolCallLLMMessageOptions>;
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
      const toolCalls = getToolCallsFromResponse(
        fullResponse as ChatResponseChunk<ToolCallLLMMessageOptions>,
      );
      return new ChatWithToolsResponse({
        toolCalls,
        toolCallMessage: fullResponse as unknown as ChatMessage,
      });
    } else {
      throw new Error("Cannot get tool calls from response");
    }
  }

  return new ChatWithToolsResponse({
    toolCalls: [],
    responseGenerator: generator as AsyncGenerator<ChatMessage>,
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
