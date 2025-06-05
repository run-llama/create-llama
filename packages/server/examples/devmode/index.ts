import { OpenAI } from "@llamaindex/openai";
import { LlamaIndexServer } from "@llamaindex/server";
import { Settings } from "llamaindex";
import { workflowFactory } from "./src/app/workflow";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

new LlamaIndexServer({
  workflow: workflowFactory,
  uiConfig: {
    devMode: true,
    starterQuestions: [
      "What is the weather in Tokyo?",
      "What is the weather in New York?",
    ],
  },
  port: 3000,
}).start();
