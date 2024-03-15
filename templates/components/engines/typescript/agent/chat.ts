import {
  OpenAI,
  QueryEngineTool,
  OpenAIAgent,
} from "llamaindex";
import { getDataSource } from "./index";
import { STORAGE_CACHE_DIR } from "./constants.mjs";
import ToolFactory from "./tools";

export async function createChatEngine(llm: OpenAI) {
  const index = await getDataSource(llm);
  const queryEngine = index.asQueryEngine();
  const queryEngineTool = new QueryEngineTool({
    queryEngine: queryEngine,
    metadata: {
      name: "data_query_engine",
      description: `A query engine for documents in storage folder: ${STORAGE_CACHE_DIR}`,
    },
  });

  const externalTools = await ToolFactory.list();

  const agent = new OpenAIAgent({
    tools: [queryEngineTool, ...externalTools],
    verbose: true,
    llm,
  });

  return agent;
}
