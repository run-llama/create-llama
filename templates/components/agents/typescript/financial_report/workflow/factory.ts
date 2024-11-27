import { ChatMessage, ToolCallLLM } from "llamaindex";
import { getTool } from "../engine/tools";
import { FinancialReportWorkflow } from "./fin-report";
import { getQueryEngineTool } from "./tools";

const TIMEOUT = 360 * 1000;

export async function createWorkflow(options: {
  chatHistory: ChatMessage[];
  llm?: ToolCallLLM;
}) {
  const queryEngineTool = await getQueryEngineTool();
  const codeInterpreterTool = await getTool("interpreter");
  const documentGeneratorTool = await getTool("document_generator");

  if (!queryEngineTool || !codeInterpreterTool || !documentGeneratorTool) {
    throw new Error("One or more required tools are not defined");
  }

  return new FinancialReportWorkflow({
    chatHistory: options.chatHistory,
    queryEngineTool,
    codeInterpreterTool,
    documentGeneratorTool,
    llm: options.llm,
    timeout: TIMEOUT,
  });
}
