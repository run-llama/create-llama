import { agent, BaseToolWithCall, Settings, ToolCallLLM } from "llamaindex";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataSource } from "../engine";
import { createTools } from "../engine/tools";
import { createQueryEngineTool } from "../engine/tools/query-engine";

async function createWorkflow(documentIds?: string[], params?: any) {
  if (!(Settings.llm instanceof ToolCallLLM)) {
    throw new Error(
      "The current LLM does not support tool calls. Please use a model that supports tool calls.",
    );
  }

  // Initialize tools
  const tools: BaseToolWithCall[] = [];

  const index = await getDataSource(params);
  if (index) {
    tools.push(createQueryEngineTool(index, { documentIds }));
  }

  const configFile = path.join("config", "tools.json");
  let toolConfig: any;
  try {
    toolConfig = JSON.parse(await fs.readFile(configFile, "utf8"));
  } catch (e) {
    console.info(`Could not read ${configFile} file. Using no tools.`);
  }
  if (toolConfig) {
    tools.push(...(await createTools(toolConfig)));
  }

  // Create an single agent with the tools
  const chatAgent = agent({
    tools,
    llm: Settings.llm,
    verbose: true,
  });

  return chatAgent;
}

export { createWorkflow };
