import { LlamaIndexServer } from "@llamaindex/server";
import { workflowFactory } from "./src/app/workflow";

new LlamaIndexServer({
  workflow: workflowFactory,
  uiConfig: {
    appTitle: "Calculator",
    devMode: true,
    starterQuestions: [
      "What is the weather in Tokyo?",
      "What is the weather in New York?",
    ],
  },
  port: 6005,
}).start();