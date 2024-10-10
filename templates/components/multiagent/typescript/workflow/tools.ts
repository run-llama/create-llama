import fs from "fs/promises";
import { BaseToolWithCall, QueryEngineTool } from "llamaindex";
import path from "path";
import { getDataSource } from "../engine";
import { createTools } from "../engine/tools/index";

export const getQueryEngineTool = async (
  params?: any,
): Promise<QueryEngineTool | null> => {
  const index = await getDataSource(params);
  if (!index) {
    return null;
  }

  const topK = process.env.TOP_K ? parseInt(process.env.TOP_K) : undefined;
  return new QueryEngineTool({
    queryEngine: index.asQueryEngine({
      similarityTopK: topK,
    }),
    metadata: {
      name: "query_index",
      description: `Use this tool to retrieve information about the text corpus from the index.`,
    },
  });
};

export const getAvailableTools = async () => {
  const configFile = path.join("config", "tools.json");
  let toolConfig: any;
  const tools: BaseToolWithCall[] = [];
  try {
    toolConfig = JSON.parse(await fs.readFile(configFile, "utf8"));
  } catch (e) {
    console.info(`Could not read ${configFile} file. Using no tools.`);
  }
  if (toolConfig) {
    tools.push(...(await createTools(toolConfig)));
  }
  const queryEngineTool = await getQueryEngineTool();
  if (queryEngineTool) {
    tools.push(queryEngineTool);
  }

  return tools;
};

export const lookupTools = async (
  toolNames: string[],
): Promise<BaseToolWithCall[]> => {
  const availableTools = await getAvailableTools();
  return availableTools.filter((tool) =>
    toolNames.includes(tool.metadata.name),
  );
};
