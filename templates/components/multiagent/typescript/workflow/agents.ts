import { ChatMessage, QueryEngineTool } from "llamaindex";
import { getDataSource } from "../engine";
import { FunctionCallingAgent } from "./single-agent";

const getQueryEngineTool = async () => {
  const index = await getDataSource();
  if (!index) {
    throw new Error(
      "StorageContext is empty - call 'npm run generate' to generate the storage first.",
    );
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
    systemPrompt:
      "You are a researcher agent. You are given a researching task. You must use your tools to complete the research.",
    chatHistory,
  });
};

export const createWriter = (chatHistory: ChatMessage[]) => {
  return new FunctionCallingAgent({
    name: "writer",
    systemPrompt:
      "You are an expert in writing blog posts. You are given a task to write a blog post. Don't make up any information yourself.",
    chatHistory,
  });
};

export const createReviewer = (chatHistory: ChatMessage[]) => {
  return new FunctionCallingAgent({
    name: "reviewer",
    systemPrompt:
      "You are an expert in reviewing blog posts. You are given a task to review a blog post. Review the post for logical inconsistencies, ask critical questions, and provide suggestions for improvement. Furthermore, proofread the post for grammar and spelling errors. Only if the post is good enough for publishing, then you MUST return 'The post is good.'. In all other cases return your review.",
    chatHistory,
  });
};
