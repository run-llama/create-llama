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
    "Key challenges for Apple and Tesla?",
    "Research about Apple and Tesla revenue",
  ],
}).start();
