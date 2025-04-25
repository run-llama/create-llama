import { LlamaIndexServer } from "@llamaindex/server";
import "dotenv/config";
import { initSettings } from "./app/settings";
import { workflowFactory } from "./app/workflow";

initSettings();

new LlamaIndexServer({
  workflow: workflowFactory,
  uiConfig: {
    appTitle: "LlamaIndex App",
    componentsDir: "components",
  },
}).start();
