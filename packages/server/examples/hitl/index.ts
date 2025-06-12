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
      "Check status of git in the current directory",
      "List all files in the current directory",
    ],
    componentsDir: "components",
  },
  port: 3000,
}).start();
