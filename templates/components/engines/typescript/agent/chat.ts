import {
  BaseTool,
  OpenAI,
  OpenAIAgent,
  QueryEngineTool,
  ToolFactory,
} from "llamaindex";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataSource } from "./index";
import { STORAGE_CACHE_DIR } from "./shared";

export async function createChatEngine(llm: OpenAI) {
  let tools: BaseTool[] = [];

  // Add a query engine tool if we have a data source
  // Delete this code if you don't have a data source
  const index = await getDataSource(llm);
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
    tools = tools.concat(await ToolFactory.createTools(config));
  } catch {}

  return new OpenAIAgent({
    tools,
    llm,
    verbose: true,
  });
}
