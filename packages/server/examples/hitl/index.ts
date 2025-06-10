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
      "List all files in the current directory",
      "Fetch changes from the remote repository",
    ],
    componentsDir: "components",
  },
  port: 3000,
}).start();
