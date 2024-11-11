import { Message } from "ai";
import { ChatMessage, ToolCallLLM } from "llamaindex";
import { getAnnotations } from "../llamaindex/streaming/annotations";
import { FinancialReportWorkflow } from "./finReport";
import { getAvailableTools } from "./tools";

const TIMEOUT = 360 * 1000;

const prepareChatHistory = (chatHistory: Message[]): ChatMessage[] => {
  // By default, the chat history only contains the assistant and user messages
  // all the agents messages are stored in annotation data which is not visible to the LLM

  const MAX_AGENT_MESSAGES = 10;
  const agentAnnotations = getAnnotations<{ agent: string; text: string }>(
    chatHistory,
    { role: "assistant", type: "agent" },
  ).slice(-MAX_AGENT_MESSAGES);

  const agentMessages = agentAnnotations
    .map(
      (annotation) =>
        `\n<${annotation.data.agent}>\n${annotation.data.text}\n</${annotation.data.agent}>`,
    )
    .join("\n");

  const agentContent = agentMessages
    ? "Here is the previous conversation of agents:\n" + agentMessages
    : "";

  if (agentContent) {
    const agentMessage: ChatMessage = {
      role: "assistant",
      content: agentContent,
    };
    return [
      ...chatHistory.slice(0, -1),
      agentMessage,
      chatHistory.slice(-1)[0],
    ] as ChatMessage[];
  }
  return chatHistory as ChatMessage[];
};

export async function createWorkflow(options: {
  chatHistory: Message[];
  llm?: ToolCallLLM;
  writeEvents?: boolean;
}) {
  const chatHistoryWithAgentMessages = prepareChatHistory(options.chatHistory);

  const tools = await getAvailableTools();
  const queryEngineTools = tools.filter((tool) =>
    tool.metadata.name.includes("retriever"),
  );
  const documentGeneratorTool = tools.find(
    (tool) => tool.metadata.name === "document_generator",
  );
  const codeInterpreterTool = tools.find(
    (tool) => tool.metadata.name === "interpreter",
  );

  if (!documentGeneratorTool || !codeInterpreterTool || !queryEngineTools) {
    throw new Error(
      "These tools are required: document_generator, code_interpreter, retriever",
    );
  }

  return new FinancialReportWorkflow({
    chatHistory: chatHistoryWithAgentMessages,
    queryEngineTools,
    codeInterpreterTool,
    documentGeneratorTool,
    llm: options.llm,
    writeEvents: options.writeEvents,
    timeout: TIMEOUT,
  });
}
