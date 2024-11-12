import { ChatMessage, ToolCallLLM } from "llamaindex";
import { getQueryEngineTools } from "../../../../multiagent/typescript/workflow/tools";
import { getTool } from "../engine/tools";
import { FormFillingWorkflow } from "./form-filling";

const TIMEOUT = 360 * 1000;

export async function createWorkflow(options: {
  chatHistory: ChatMessage[];
  llm?: ToolCallLLM;
}) {
  return new FormFillingWorkflow({
    chatHistory: options.chatHistory,
    queryEngineTools: (await getQueryEngineTools()) || [],
    extractorTool: (await getTool("extract_missing_cells"))!,
    fillMissingCellsTool: (await getTool("fill_missing_cells"))!,
    llm: options.llm,
    timeout: TIMEOUT,
  });
}
