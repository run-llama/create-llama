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
    starterQuestions: [
      "Generate a calculator app",
      "Create a simple todo list app",
    ],
    componentsDir: "components",
  },
  port: 3000,
}).start();
