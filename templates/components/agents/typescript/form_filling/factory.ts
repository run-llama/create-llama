import { ChatMessage, ToolCallLLM } from "@llamaindex/core";
import { FormFillingWorkflow } from "./formFilling";
import { getAvailableTools } from "./tools";

export async function createWorkflow(options: {
  chatHistory: ChatMessage[];
  llm?: ToolCallLLM;
  writeEvents?: boolean;
}) {
  const tools = await getAvailableTools();
  const extractorTool = tools.find(
    (tool) => tool.metadata.name === "extract_missing_cells",
  );
  const queryEngineTool = tools.find(
    (tool) => tool.metadata.name === "retriever",
  );

  if (!extractorTool || !queryEngineTool) {
    throw new Error(
      "Expected extract_missing_cells and data_query_engine tools",
    );
  }

  const formFilling = new FormFillingWorkflow({
    chatHistory: options.chatHistory,
    extractorTool,
    queryEngineTool,
    llm: options.llm,
    writeEvents: options.writeEvents,
  });

  return formFilling;
}
