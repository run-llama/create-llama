import { ChatMessage, ToolCallLLM } from "llamaindex";
import { getTool } from "../engine/tools";
import { FinancialReportWorkflow } from "./fin-report";
import { getQueryEngineTool } from "./tools";

const TIMEOUT = 360 * 1000;

export async function createWorkflow(options: {
  chatHistory: ChatMessage[];
  llm?: ToolCallLLM;
}) {
  return new FinancialReportWorkflow({
    chatHistory: options.chatHistory,
    queryEngineTool: (await getQueryEngineTool())!,
    codeInterpreterTool: (await getTool("interpreter"))!,
    documentGeneratorTool: (await getTool("document_generator"))!,
    llm: options.llm,
    timeout: TIMEOUT,
  });
}
