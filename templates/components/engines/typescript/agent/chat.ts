import { BaseToolWithCall, OpenAIAgent, QueryEngineTool } from "llamaindex";
import { ToolsFactory } from "llamaindex/tools/ToolsFactory";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataSource } from "./index";
import { STORAGE_CACHE_DIR } from "./shared";
import { getFunctionTools } from "./tools";

export async function createChatEngine() {
  const tools: BaseToolWithCall[] = [];

  // Add a query engine tool if we have a data source
  // Delete this code if you don't have a data source
  const index = await getDataSource();
  if (index) {
    tools.push(
      new QueryEngineTool({
        queryEngine: index.asQueryEngine(),
        metadata: {
          name: "data_query_engine",
          description: `A query engine for documents in storage folder: ${STORAGE_CACHE_DIR}`,
        },
      }),
    );
  }

  try {
    // add tools from config file if it exists
    const config = JSON.parse(
      await fs.readFile(path.join("config", "tools.json"), "utf8"),
    );

    // add function tools
    const functionTools = getFunctionTools(config.local);
    tools.push(...functionTools);

    // add llama tools
    const llamaTools = await ToolsFactory.createTools(config.llama);
    tools.push(...llamaTools);
  } catch {}

  return new OpenAIAgent({
    tools,
  });
}
