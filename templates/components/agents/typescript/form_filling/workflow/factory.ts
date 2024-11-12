import { ChatMessage, ToolCallLLM } from "llamaindex";
import { FormFillingWorkflow } from "./formFilling";
import { getAvailableTools } from "./tools";

const TIMEOUT = 360 * 1000;

export async function createWorkflow(options: {
  chatHistory: ChatMessage[];
  llm?: ToolCallLLM;
}) {
  const tools = await getAvailableTools();
  const extractorTool = tools.find(
    (tool) => tool.metadata.name === "extract_missing_cells",
  );
  const queryEngineTools = tools.filter((tool) =>
    tool.metadata.name.includes("retriever"),
  );
  const fillMissingCellsTool = tools.find(
    (tool) => tool.metadata.name === "fill_missing_cells",
  );

  if (!extractorTool) {
    throw new Error("Extractor tool not found");
  }
  if (!fillMissingCellsTool) {
    throw new Error("Fill missing cells tool not found");
  }

  const formFilling = new FormFillingWorkflow({
    chatHistory: options.chatHistory,
    extractorTool,
    queryEngineTools,
    fillMissingCellsTool,
    llm: options.llm,
    timeout: TIMEOUT,
  });

  return formFilling;
}
