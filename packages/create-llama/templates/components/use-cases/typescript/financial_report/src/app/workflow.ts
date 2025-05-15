import { toAgentRunEvent, toSourceEvent } from "@llamaindex/server";
import {
  callTools,
  chatWithTools,
  documentGenerator,
  interpreter,
} from "@llamaindex/tools";
import {
  agentStreamEvent,
  createStatefulMiddleware,
  createWorkflow,
  startAgentEvent,
  stopAgentEvent,
  workflowEvent,
} from "@llamaindex/workflow";
import {
  BaseToolWithCall,
  ChatMemoryBuffer,
  ChatMessage,
  Metadata,
  NodeWithScore,
  Settings,
  ToolCall,
  ToolCallLLM,
} from "llamaindex";
import { getIndex } from "./data";

export async function workflowFactory(reqBody: any) {
  const index = await getIndex(reqBody?.data);

  const queryEngineTool = index.queryTool({
    metadata: {
      name: "query_document",
      description: `This tool can retrieve information about Apple and Tesla financial data`,
    },
    includeSourceNodes: true,
  });

  if (!process.env.E2B_API_KEY) {
    throw new Error("E2B_API_KEY is required to use the code interpreter tool");
  }

  const codeInterpreterTool = interpreter({
    apiKey: process.env.E2B_API_KEY!,
  });
  const documentGeneratorTool = documentGenerator();

  return getWorkflow(
    queryEngineTool,
    codeInterpreterTool,
    documentGeneratorTool,
  );
}

// workflow events
const inputEvent = workflowEvent<{ input: ChatMessage[] }>();
const researchEvent = workflowEvent<{ toolCalls: ToolCall[] }>();
const analyzeEvent = workflowEvent<{ input: ChatMessage | ToolCall[] }>();
const reportGenerationEvent = workflowEvent<{ toolCalls: ToolCall[] }>();

const DEFAULT_SYSTEM_PROMPT = `
You are a financial analyst who are given a set of tools to help you.
It's good to using appropriate tools for the user request and always use the information from the tools, don't make up anything yourself.
For the query engine tool, you should break down the user request into a list of queries and call the tool with the queries.
`;

// workflow definition
export function getWorkflow(
  queryEngineTool: BaseToolWithCall,
  codeInterpreterTool: BaseToolWithCall,
  documentGeneratorTool: BaseToolWithCall,
) {
  const llm = Settings.llm as ToolCallLLM;
  if (!llm.supportToolCall) {
    throw new Error("LLM is not a ToolCallLLM");
  }
  const { withState, getContext } = createStatefulMiddleware(() => ({
    memory: new ChatMemoryBuffer({ llm, chatHistory: [] }),
  }));

  const workflow = withState(createWorkflow());

  // Add steps
  workflow.handle([startAgentEvent], async ({ data }) => {
    const { state } = getContext();
    const { userInput, chatHistory = [] } = data;
    if (!userInput) throw new Error("Invalid input");

    state.memory.set(chatHistory);

    state.memory.put({ role: "system", content: DEFAULT_SYSTEM_PROMPT });

    state.memory.put({ role: "user", content: userInput });

    const messages = await state.memory.getMessages();
    return inputEvent.with({ input: messages });
  });

  workflow.handle([inputEvent], async ({ data }) => {
    const { sendEvent, state } = getContext();
    const chatHistory = data.input;

    const tools = [codeInterpreterTool, documentGeneratorTool, queryEngineTool];

    const toolCallResponse = await chatWithTools(llm, tools, chatHistory);

    if (!toolCallResponse.hasToolCall()) {
      const generator = toolCallResponse.responseGenerator;
      let response = "";
      if (generator) {
        for await (const chunk of generator) {
          response += chunk.delta;
          sendEvent(
            agentStreamEvent.with({
              delta: chunk.delta,
              response,
              currentAgentName: "LLM", // Or derive from context if needed
              raw: chunk.raw,
            }),
          );
        }
      }
      return stopAgentEvent.with({ result: response });
    }

    if (toolCallResponse.hasMultipleTools()) {
      state.memory.put({
        role: "assistant",
        content:
          "Calling different tools is not allowed. Please only use multiple calls of the same tool.",
      });
      const newChatHistory = await state.memory.getMessages();
      return inputEvent.with({ input: newChatHistory });
    }

    // Put the LLM tool call message into the memory
    // And trigger the next step according to the tool call
    if (toolCallResponse.toolCallMessage) {
      state.memory.put(toolCallResponse.toolCallMessage);
    }
    const toolName = toolCallResponse.getToolNames()[0];
    switch (toolName) {
      case codeInterpreterTool.metadata.name:
        return analyzeEvent.with({
          input: toolCallResponse.toolCalls,
        });
      case documentGeneratorTool.metadata.name:
        return reportGenerationEvent.with({
          toolCalls: toolCallResponse.toolCalls,
        });
      default:
        if (queryEngineTool.metadata.name === toolName) {
          return researchEvent.with({
            toolCalls: toolCallResponse.toolCalls,
          });
        }
        throw new Error(`Unknown tool: ${toolName}`);
    }
  });

  workflow.handle([researchEvent], async ({ data }) => {
    const { sendEvent, state } = getContext();
    sendEvent(
      toAgentRunEvent({
        agent: "Researcher",
        text: "Researching data",
        type: "text",
      }),
    );

    const { toolCalls } = data;

    const toolMsgs = await callTools({
      tools: [queryEngineTool],
      toolCalls,
      writeEvent: (text, step) => {
        sendEvent(
          toAgentRunEvent({
            agent: "Researcher",
            text,
            type: toolCalls.length > 1 ? "progress" : "text",
            current: step,
            total: toolCalls.length,
          }),
        );
      },
    });
    for (const toolMsg of toolMsgs) {
      state.memory.put(toolMsg);
    }

    const sourcesNodes: NodeWithScore<Metadata>[] = toolMsgs
      .map((msg) => (msg.options as any)?.toolResult?.result?.sourceNodes)
      .flat()
      .filter(Boolean);

    if (sourcesNodes.length > 0) {
      sendEvent(toSourceEvent(sourcesNodes));
    }

    // Send a message indicating research is done, triggering analysis
    return analyzeEvent.with({
      input: {
        role: "assistant",
        content:
          "I have finished researching the data, please analyze the data.",
      },
    });
  });

  /**
   * Analyze a research result or a tool call for code interpreter from the LLM
   */
  workflow.handle([analyzeEvent], async ({ data }) => {
    const { sendEvent, state } = getContext();
    sendEvent(
      toAgentRunEvent({
        agent: "Analyst",
        text: "Analyzing data",
        type: "text",
      }),
    );
    // Request by workflow LLM, input is a list of tool calls
    let toolCalls: ToolCall[] = [];
    if (Array.isArray(data.input)) {
      toolCalls = data.input;
    } else {
      // Requested by Researcher, input is a ChatMessage
      // We start new LLM chat specifically for analyzing the data
      const analysisPrompt = `
      You are an expert in analyzing financial data.
      You are given a set of financial data to analyze. Your task is to analyze the financial data and return a report.
      Your response should include a detailed analysis of the financial data, including any trends, patterns, or insights that you find.
      Construct the analysis in textual format; including tables would be great!
      Don't need to synthesize the data, just analyze and provide your findings.
      `;

      // Clone the current chat history
      // Add the analysis system prompt and the message from the researcher
      const currentChatHistory = await state.memory.getMessages();
      const newChatHistory = [
        ...currentChatHistory,
        { role: "system", content: analysisPrompt },
        data.input, // This is the ChatMessage from the research step
      ];
      const toolCallResponse = await chatWithTools(
        llm,
        [codeInterpreterTool],
        newChatHistory as ChatMessage[],
      );

      if (!toolCallResponse.hasToolCall()) {
        // If no tool call needed for analysis, put the response directly
        state.memory.put(await toolCallResponse.asFullResponse());
        const finalChatHistory = await state.memory.getMessages();
        return inputEvent.with({ input: finalChatHistory });
      } else {
        state.memory.put(toolCallResponse.toolCallMessage!);
        toolCalls = toolCallResponse.toolCalls;
      }
    }

    // Call the code interpreter tools if needed
    if (toolCalls.length > 0) {
      const toolMsgs = await callTools({
        tools: [codeInterpreterTool],
        toolCalls,
        writeEvent: (text, step) => {
          sendEvent(
            toAgentRunEvent({
              agent: "Analyst",
              text,
              type: toolCalls.length > 1 ? "progress" : "text",
              current: step,
              total: toolCalls.length,
            }),
          );
        },
      });
      for (const toolMsg of toolMsgs) {
        state.memory.put(toolMsg);
      }
    }

    const finalChatHistory = await state.memory.getMessages();
    // After analysis (or tool calls for analysis), trigger the next LLM input cycle
    return inputEvent.with({ input: finalChatHistory });
  });

  workflow.handle([reportGenerationEvent], async ({ data }) => {
    const { sendEvent, state } = getContext();
    const { toolCalls } = data;

    const toolMsgs = await callTools({
      tools: [documentGeneratorTool],
      toolCalls,
      writeEvent: (text, step) => {
        sendEvent(
          toAgentRunEvent({
            agent: "Reporter",
            text,
            type: toolCalls.length > 1 ? "progress" : "text",
            current: step,
            total: toolCalls.length,
          }),
        );
      },
    });
    for (const toolMsg of toolMsgs) {
      state.memory.put(toolMsg);
    }
    const chatHistory = await state.memory.getMessages();
    // After report generation, trigger the next LLM input cycle
    return inputEvent.with({ input: chatHistory });
  });

  return workflow;
}
