import { LlamaIndexServer } from "@llamaindex/server";

new LlamaIndexServer({
  uiConfig: {
    componentsDir: "components",
    layoutDir: "layout",
    llamaDeploy: { deployment: "chat", workflow: "workflow" },
  },
  llamaCloud: {
    indexSelector: true,
    outputDir: "output/llamacloud",
  },
}).start();
