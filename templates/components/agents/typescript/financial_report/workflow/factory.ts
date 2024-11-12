import { ChatMessage, ToolCallLLM } from "llamaindex";
import { FinancialReportWorkflow } from "./fin-report";
import { getAvailableTools } from "./tools";

const TIMEOUT = 360 * 1000;

export async function createWorkflow(options: {
  chatHistory: ChatMessage[];
  llm?: ToolCallLLM;
}) {
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
  if (!queryEngineTools?.length) {
    throw new Error("Query engine tools array must not be empty");
  }
  if (!documentGeneratorTool) {
    throw new Error("Document generator tool not found");
  }
  if (!codeInterpreterTool) {
    throw new Error("Code interpreter tool not found");
  }

  return new FinancialReportWorkflow({
    chatHistory: options.chatHistory,
    queryEngineTools,
    codeInterpreterTool,
    documentGeneratorTool,
    llm: options.llm,
    timeout: TIMEOUT,
  });
}
