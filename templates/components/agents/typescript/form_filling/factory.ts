import { Message } from "ai";
import { ChatMessage, ToolCallLLM } from "llamaindex";
import { getAnnotations } from "../llamaindex/streaming/annotations";
import { FormFillingWorkflow } from "./form-filling";
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
  const enhancedChatHistory = prepareChatHistory(options.chatHistory);

  const tools = await getAvailableTools();
  const extractorTool = tools.find(
    (tool) => tool.metadata.name === "extract_missing_cells",
  );
  const queryEngineTool = tools.find(
    (tool) => tool.metadata.name === "retriever",
  );
  const fillMissingCellsTool = tools.find(
    (tool) => tool.metadata.name === "fill_missing_cells",
  );

  if (!extractorTool || !queryEngineTool || !fillMissingCellsTool) {
    throw new Error(
      "Expected extract_missing_cells, data_query_engine and fill_missing_cells tools",
    );
  }

  const formFilling = new FormFillingWorkflow({
    chatHistory: enhancedChatHistory,
    extractorTool,
    queryEngineTool,
    fillMissingCellsTool,
    llm: options.llm,
    writeEvents: options.writeEvents,
    timeout: TIMEOUT,
  });

  return formFilling;
}
