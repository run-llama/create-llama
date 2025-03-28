import { LlamaIndexServer } from "@llamaindex/server";
import "dotenv/config";
import { initSettings } from "./app/settings";
import { workflowFactory } from "./app/workflow";

initSettings();

new LlamaIndexServer({
  workflow: workflowFactory,
  appTitle: "LlamaIndex App",
  useLlamaCloud: false,
  starterQuestions: [
    "Research about Apple and Tesla revenue",
    "How to improve the revenue of Apple and Tesla",
  ],
}).start();
