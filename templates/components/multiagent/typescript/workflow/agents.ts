import fs from "fs/promises";
import { BaseToolWithCall, ChatMessage, QueryEngineTool } from "llamaindex";
import path from "path";
import { getDataSource } from "../engine";
import { createTools } from "../engine/tools/index";
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

const getAvailableTools = async () => {
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

  return tools;
};

export const createResearcher = async (chatHistory: ChatMessage[]) => {
  const tools = await getAvailableTools();
  const researcherTools = [await getQueryEngineTool()];
  // Add wikipedia, duckduckgo if they are available
  for (const tool of tools) {
    if (
      tool.metadata.name === "wikipedia.WikipediaToolSpec" ||
      tool.metadata.name === "duckduckgo_search"
    ) {
      researcherTools.push(tool as any);
    }
  }
  return new FunctionCallingAgent({
    name: "researcher",
    tools: researcherTools,
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

export const createPublisher = async (chatHistory: ChatMessage[]) => {
  const tools = await getAvailableTools();
  const publisherTools: BaseToolWithCall[] = [];
  for (const tool of tools) {
    if (tool.metadata.name === "document_generator") {
      publisherTools.push(tool);
    }
  }
  return new FunctionCallingAgent({
    name: "publisher",
    tools: publisherTools,
    systemPrompt:
      "You are an expert in publishing blog posts. You are given a task to publish a blog post.",
    chatHistory,
  });
};
