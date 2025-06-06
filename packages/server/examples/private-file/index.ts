import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import { LlamaIndexServer } from "@llamaindex/server";
import { Settings } from "llamaindex";
import { workflowFactory } from "./agent-workflow";
// Uncomment this to use a custom workflow
// import { workflowFactory } from "./custom-workflow";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small",
});

new LlamaIndexServer({
  workflow: workflowFactory,
  suggestNextQuestions: false,
  uiConfig: {
    enableFileUpload: true,
  },
  port: 3000,
}).start();
