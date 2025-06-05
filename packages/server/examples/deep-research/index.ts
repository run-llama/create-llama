import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import { LlamaIndexServer } from "@llamaindex/server";
import { Settings } from "llamaindex";
import { workflowFactory } from "./src/app/workflow";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small",
});

new LlamaIndexServer({
  workflow: workflowFactory,
  uiConfig: {
    starterQuestions: [
      "Research about Google and Apple",
      "List all the services of Google and Apple",
    ],
    componentsDir: "components",
  },
  port: 3000,
}).start();
