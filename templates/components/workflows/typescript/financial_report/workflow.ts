import { toAgentRunEvent, toSourceEvent } from "@llamaindex/server";
import {
  callTools,
  chatWithTools,
  documentGenerator,
  interpreter,
} from "@llamaindex/tools";
import {
  AgentInputData,
  AgentWorkflowContext,
  BaseToolWithCall,
  ChatMemoryBuffer,
  ChatMessage,
  ChatResponseChunk,
  HandlerContext,
  Metadata,
  NodeWithScore,
  Settings,
  StartEvent,
  StopEvent,
  ToolCall,
  ToolCallLLM,
  Workflow,
  WorkflowEvent,
} from "llamaindex";
import { getIndex } from "../data";

const TIMEOUT = 360 * 1000;
const OUT_DIR = "output/tools";
const UPLOADED_FILE_DIR = "output/uploaded";
const FILE_SERVER_URL_PREFIX = "/api/files";

export async function workflowFactory() {
  const index = await getIndex();

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
    uploadedFilesDir: UPLOADED_FILE_DIR,
    outputDir: OUT_DIR,
    fileServerURLPrefix: FILE_SERVER_URL_PREFIX,
  });
  const documentGeneratorTool = documentGenerator({
    outputDir: "output/tools",
    fileServerURLPrefix: FILE_SERVER_URL_PREFIX,
  });

  return new FinancialReportWorkflow({
    queryEngineTool,
    codeInterpreterTool,
    documentGeneratorTool,
    timeout: TIMEOUT,
  });
}

// Create a custom event type
class InputEvent extends WorkflowEvent<{ input: ChatMessage[] }> {}

class ResearchEvent extends WorkflowEvent<{
  toolCalls: ToolCall[];
}> {}

class AnalyzeEvent extends WorkflowEvent<{
  input: ChatMessage | ToolCall[];
}> {}

class ReportGenerationEvent extends WorkflowEvent<{
  toolCalls: ToolCall[];
}> {}

const DEFAULT_SYSTEM_PROMPT = `
You are a financial analyst who are given a set of tools to help you.
It's good to using appropriate tools for the user request and always use the information from the tools, don't make up anything yourself.
For the query engine tool, you should break down the user request into a list of queries and call the tool with the queries.
`;

class FinancialReportWorkflow extends Workflow<
  AgentWorkflowContext,
  AgentInputData,
  string
> {
  llm: ToolCallLLM;
  memory: ChatMemoryBuffer;
  queryEngineTool: BaseToolWithCall;
  codeInterpreterTool: BaseToolWithCall;
  documentGeneratorTool: BaseToolWithCall;
  systemPrompt?: string;

  constructor(options: {
    queryEngineTool: BaseToolWithCall;
    codeInterpreterTool: BaseToolWithCall;
    documentGeneratorTool: BaseToolWithCall;
    systemPrompt?: string;
    verbose?: boolean;
    timeout?: number;
  }) {
    super({
      verbose: options?.verbose ?? false,
      timeout: options?.timeout ?? 360,
    });

    this.llm = Settings.llm as ToolCallLLM;
    if (!this.llm.supportToolCall) {
      throw new Error("LLM is not a ToolCallLLM");
    }
    this.systemPrompt = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
    this.queryEngineTool = options.queryEngineTool;
    this.codeInterpreterTool = options.codeInterpreterTool;

    this.documentGeneratorTool = options.documentGeneratorTool;
    this.memory = new ChatMemoryBuffer({ llm: this.llm, chatHistory: [] });

    // Add steps
    this.addStep(
      {
        inputs: [StartEvent<AgentInputData>],
        outputs: [InputEvent],
      },
      this.prepareChatHistory,
    );

    this.addStep(
      {
        inputs: [InputEvent],
        outputs: [
          InputEvent,
          ResearchEvent,
          AnalyzeEvent,
          ReportGenerationEvent,
          StopEvent,
        ],
      },
      this.handleLLMInput,
    );

    this.addStep(
      {
        inputs: [ResearchEvent],
        outputs: [AnalyzeEvent],
      },
      this.handleResearch,
    );

    this.addStep(
      {
        inputs: [AnalyzeEvent],
        outputs: [InputEvent],
      },
      this.handleAnalyze,
    );

    this.addStep(
      {
        inputs: [ReportGenerationEvent],
        outputs: [InputEvent],
      },
      this.handleReportGeneration,
    );
  }

  prepareChatHistory = async (
    ctx: HandlerContext<AgentWorkflowContext>,
    ev: StartEvent<AgentInputData>,
  ): Promise<InputEvent> => {
    const { userInput, chatHistory = [] } = ev.data;
    if (!userInput) throw new Error("Invalid input");

    this.memory.set(chatHistory);

    if (this.systemPrompt) {
      this.memory.put({ role: "system", content: this.systemPrompt });
    }

    this.memory.put({ role: "user", content: userInput });

    const messages = await this.memory.getMessages();
    return new InputEvent({ input: messages });
  };

  handleLLMInput = async (
    ctx: HandlerContext<AgentWorkflowContext>,
    ev: InputEvent,
  ): Promise<
    | InputEvent
    | ResearchEvent
    | AnalyzeEvent
    | ReportGenerationEvent
    | StopEvent<AsyncGenerator<ChatResponseChunk, any, any> | undefined>
  > => {
    const chatHistory = ev.data.input;

    const tools = [
      this.codeInterpreterTool,
      this.documentGeneratorTool,
      this.queryEngineTool,
    ];

    const toolCallResponse = await chatWithTools(this.llm, tools, chatHistory);

    if (!toolCallResponse.hasToolCall()) {
      return new StopEvent(toolCallResponse.responseGenerator);
    }

    if (toolCallResponse.hasMultipleTools()) {
      this.memory.put({
        role: "assistant",
        content:
          "Calling different tools is not allowed. Please only use multiple calls of the same tool.",
      });
      const chatHistory = await this.memory.getMessages();
      return new InputEvent({ input: chatHistory });
    }

    // Put the LLM tool call message into the memory
    // And trigger the next step according to the tool call
    if (toolCallResponse.toolCallMessage) {
      this.memory.put(toolCallResponse.toolCallMessage);
    }
    const toolName = toolCallResponse.getToolNames()[0];
    switch (toolName) {
      case this.codeInterpreterTool.metadata.name:
        return new AnalyzeEvent({
          input: toolCallResponse.toolCalls,
        });
      case this.documentGeneratorTool.metadata.name:
        return new ReportGenerationEvent({
          toolCalls: toolCallResponse.toolCalls,
        });
      default:
        if (this.queryEngineTool.metadata.name === toolName) {
          return new ResearchEvent({
            toolCalls: toolCallResponse.toolCalls,
          });
        }
        throw new Error(`Unknown tool: ${toolName}`);
    }
  };

  handleResearch = async (
    ctx: HandlerContext<AgentWorkflowContext>,
    ev: ResearchEvent,
  ): Promise<AnalyzeEvent> => {
    ctx.sendEvent(
      toAgentRunEvent({
        agent: "Researcher",
        text: "Researching data",
        type: "text",
      }),
    );

    const { toolCalls } = ev.data;

    const toolMsgs = await callTools({
      tools: [this.queryEngineTool],
      toolCalls,
      writeEvent: (text, step) => {
        ctx.sendEvent(
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
      this.memory.put(toolMsg);
    }

    const sourcesNodes: NodeWithScore<Metadata>[] = toolMsgs
      .map((msg) => (msg.options as any)?.toolResult?.result?.sourceNodes)
      .flat()
      .filter(Boolean);

    if (sourcesNodes.length > 0) {
      ctx.sendEvent(toSourceEvent(sourcesNodes));
    }

    return new AnalyzeEvent({
      input: {
        role: "assistant",
        content:
          "I have finished researching the data, please analyze the data.",
      },
    });
  };

  /**
   * Analyze a research result or a tool call for code interpreter from the LLM
   */
  handleAnalyze = async (
    ctx: HandlerContext<AgentWorkflowContext>,
    ev: AnalyzeEvent,
  ): Promise<InputEvent> => {
    ctx.sendEvent(
      toAgentRunEvent({
        agent: "Analyst",
        text: "Analyzing data",
        type: "text",
      }),
    );
    // Request by workflow LLM, input is a list of tool calls
    let toolCalls: ToolCall[] = [];
    if (Array.isArray(ev.data.input)) {
      toolCalls = ev.data.input;
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
      const chatHistory = await this.memory.getMessages();
      const newChatHistory = [
        ...chatHistory,
        { role: "system", content: analysisPrompt },
        ev.data.input,
      ];
      const toolCallResponse = await chatWithTools(
        this.llm,
        [this.codeInterpreterTool],
        newChatHistory as ChatMessage[],
      );

      if (!toolCallResponse.hasToolCall()) {
        this.memory.put(await toolCallResponse.asFullResponse());
        const chatHistory = await this.memory.getMessages();
        return new InputEvent({ input: chatHistory });
      } else {
        this.memory.put(toolCallResponse.toolCallMessage!);
        toolCalls = toolCallResponse.toolCalls;
      }
    }

    // Call the tools
    const toolMsgs = await callTools({
      tools: [this.codeInterpreterTool],
      toolCalls,
      writeEvent: (text, step) => {
        ctx.sendEvent(
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
      this.memory.put(toolMsg);
    }

    const chatHistory = await this.memory.getMessages();
    return new InputEvent({ input: chatHistory });
  };

  handleReportGeneration = async (
    ctx: HandlerContext<AgentWorkflowContext>,
    ev: ReportGenerationEvent,
  ): Promise<InputEvent> => {
    const { toolCalls } = ev.data;

    const toolMsgs = await callTools({
      tools: [this.documentGeneratorTool],
      toolCalls,
      writeEvent: (text, step) => {
        ctx.sendEvent(
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
      this.memory.put(toolMsg);
    }
    const chatHistory = await this.memory.getMessages();
    return new InputEvent({ input: chatHistory });
  };
}
