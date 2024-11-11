import { ChatMessage, ToolCallLLM } from "llamaindex";
import { FinancialReportWorkflow } from "./finReport";
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

  if (!documentGeneratorTool || !codeInterpreterTool || !queryEngineTools) {
    throw new Error(
      "These tools are required: document_generator, code_interpreter, retriever",
    );
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
