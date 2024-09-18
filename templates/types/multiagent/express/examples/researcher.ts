import { ChatMessage, QueryEngineTool } from "llamaindex";
import { FunctionCallingAgent } from "../agents/single";
import { getDataSource } from "../controllers/engine";

const getQueryEngineTool = async () => {
  const index = await getDataSource();
  if (!index) {
    throw new Error("Index not found. Please create an index first.");
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

export const createResearcher = async (chatHistory: ChatMessage[]) => {
  return new FunctionCallingAgent({
    name: "researcher",
    tools: [await getQueryEngineTool()],
    role: "expert in retrieving any unknown content",
    systemPrompt:
      "You are a researcher agent. You are given a researching task. You must use your tools to complete the research.",
    chatHistory,
  });
};
