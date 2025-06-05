import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import { LlamaIndexServer } from "@llamaindex/server";
import { agent } from "@llamaindex/workflow";
import { Document, Settings, VectorStoreIndex } from "llamaindex";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small",
});

export const workflowFactory = async () => {
  const index = await VectorStoreIndex.fromDocuments([
    new Document({ text: "The dog is brown" }),
    new Document({ text: "The dog is yellow" }),
  ]);

  const queryEngineTool = index.queryTool({
    metadata: {
      name: "query_document",
      description: `This tool can retrieve information in documents`,
    },
    includeSourceNodes: true,
  });

  return agent({ tools: [queryEngineTool] });
};

new LlamaIndexServer({
  workflow: workflowFactory,
  suggestNextQuestions: true,
  uiConfig: {
    starterQuestions: ["What is the color of the dog?"],
  },
  port: 3000,
}).start();
