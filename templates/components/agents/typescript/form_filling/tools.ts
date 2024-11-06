import { Context } from "@llamaindex/workflow";
import fs from "fs/promises";
import {
  BaseToolWithCall,
  callTool,
  ChatMessage,
  ChatResponse,
  ChatResponseChunk,
  LlamaCloudIndex,
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

export const getQueryEngineTools = async (
  params?: any,
): Promise<QueryEngineTool[] | null> => {
  const topK = process.env.TOP_K ? parseInt(process.env.TOP_K) : undefined;

  const index = await getDataSource(params);
  if (!index) {
    return null;
  }
  // index is LlamaCloudIndex use two query engine tools
  if (index instanceof LlamaCloudIndex) {
    return [
      new QueryEngineTool({
        queryEngine: index.asQueryEngine({
          similarityTopK: topK,
          retrieval_mode: "files_via_content",
        }),
        metadata: {
          name: "document_retriever",
          description: `Document retriever that retrieves entire documents from the corpus.
  ONLY use for research questions that may require searching over entire research reports.
  Will be slower and more expensive than chunk-level retrieval but may be necessary.`,
        },
      }),
      new QueryEngineTool({
        queryEngine: index.asQueryEngine({
          similarityTopK: topK,
          retrieval_mode: "chunks",
        }),
        metadata: {
          name: "chunk_retriever",
          description: `Retrieves a small set of relevant document chunks from the corpus.
      Use for research questions that want to look up specific facts from the knowledge corpus,
      and need entire documents.`,
        },
      }),
    ];
  } else {
    return [
      new QueryEngineTool({
        queryEngine: (index as any).asQueryEngine({
          similarityTopK: topK,
        }),
        metadata: {
          name: "retriever",
          description: `Use this tool to retrieve information about the text corpus from the index.`,
        },
      }),
    ];
  }
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
  const queryEngineTools = await getQueryEngineTools();
  if (queryEngineTools) {
    tools.push(...queryEngineTools);
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
): Promise<ChatMessage[]> => {
  const toolMsgs: ChatMessage[] = [];
  if (toolCalls.length === 0) {
    return toolMsgs;
  }
  if (tools.length === 1) {
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
      currentStep++;
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
        role: "tool",
        options: {
          toolResult: {
            id: toolCall.id,
            isError: true,
          },
        },
      };
    },
    warn: () => {},
  });
  return {
    content: JSON.stringify(toolOutput.output),
    role: "tool",
    options: {
      toolResult: {
        id: toolCall.id,
        result: toolOutput.output,
        isError: toolOutput.isError,
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

  isCallingDifferentTool(other: ChatWithToolsResponse) {
    return (
      this.toolCalls.length > 0 &&
      other.toolCalls.length > 0 &&
      this.toolCalls[0].name !== other.toolCalls[0].name
    );
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

    if (fullResponse?.options && Object.keys(fullResponse.options).length) {
      yield fullResponse;
    }
  };

  const generator = responseGenerator();
  const isToolCall = await generator.next();

  if (isToolCall.value) {
    const fullResponse = await generator.next();
    const toolCalls = getToolCallsFromResponse(
      fullResponse.value as ChatResponseChunk<ToolCallLLMMessageOptions>,
    );
    return new ChatWithToolsResponse({
      toolCalls,
      toolCallMessage: fullResponse.value as unknown as ChatMessage,
    });
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
