import { LlamaIndexServer } from "@llamaindex/server";
// import { workflowFactory } from "./agent-workflow";
// Uncomment this to use a custom workflow
import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import { Settings } from "llamaindex";
import { workflowFactory } from "./custom-workflow";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small",
});

new LlamaIndexServer({
  workflow: workflowFactory,
  suggestNextQuestions: true,
  uiConfig: {
    enableFileUpload: true,
  },
  port: 3000,
}).start();
