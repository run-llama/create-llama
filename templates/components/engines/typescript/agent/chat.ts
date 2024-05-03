import { BaseToolWithCall, OpenAIAgent, QueryEngineTool } from "llamaindex";
import { ToolsFactory } from "llamaindex/tools/ToolsFactory";
import fs from "node:fs/promises";
import path from "node:path";
import { getDataSource } from "./index";
import { STORAGE_CACHE_DIR } from "./shared";

enum FunctionToolType {
  MATH = "math",
  WEATHER = "weather",
}

async function importFunctionTools(
  config: Record<string, unknown>,
): Promise<BaseToolWithCall[]> {
  const functionTools: FunctionToolType[] = [];
  for (const key in config) {
    if (key.startsWith("function.")) {
      const toolName = key.split(".")[1];
      functionTools.push(toolName as FunctionToolType);
    }
  }

  const tools: BaseToolWithCall[] = [];

  if (functionTools.includes(FunctionToolType.MATH)) {
    const { tools: mathTools } = await import("../function-tools/math");
    tools.push(...mathTools);
  }

  if (functionTools.includes(FunctionToolType.WEATHER)) {
    const { tools: weatherTools } = await import("../function-tools/weather");
    tools.push(...weatherTools);
  }

  return tools;
}

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

    tools.push(...(await importFunctionTools(config)));

    // Filter toolfactory config (rest of the config)
    const toolFactoryConfig = Object.keys(config).reduce(
      (acc: Record<string, unknown>, key) => {
        if (!key.startsWith("function.")) {
          acc[key] = config[key];
        }
        return acc;
      },
      {},
    );

    tools.push(...(await ToolsFactory.createTools(toolFactoryConfig as any)));
  } catch {}

  return new OpenAIAgent({
    tools,
  });
}
