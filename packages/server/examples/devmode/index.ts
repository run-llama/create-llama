import { LlamaIndexServer } from "@llamaindex/server";
import { workflowFactory } from "./src/app/workflow";

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
