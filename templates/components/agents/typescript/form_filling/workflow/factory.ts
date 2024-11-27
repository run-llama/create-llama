import { ChatMessage, ToolCallLLM } from "llamaindex";
import { getTool } from "../engine/tools";
import { FormFillingWorkflow } from "./form-filling";
import { getQueryEngineTool } from "./tools";

const TIMEOUT = 360 * 1000;

export async function createWorkflow(options: {
  chatHistory: ChatMessage[];
  llm?: ToolCallLLM;
}) {
  const extractorTool = await getTool("extract_missing_cells");
  const fillMissingCellsTool = await getTool("fill_missing_cells");

  if (!extractorTool || !fillMissingCellsTool) {
    throw new Error("One or more required tools are not defined");
  }

  return new FormFillingWorkflow({
    chatHistory: options.chatHistory,
    queryEngineTool: (await getQueryEngineTool()) || undefined,
    extractorTool,
    fillMissingCellsTool,
    llm: options.llm,
    timeout: TIMEOUT,
  });
}
