import { LlamaIndexServer } from "@llamaindex/server";

new LlamaIndexServer({
  uiConfig: {
    componentsDir: "components",
    layoutDir: "layout",
    llamaDeploy: { deployment: "chat", workflow: "workflow" },
  },
  port: 3000,
}).start();
