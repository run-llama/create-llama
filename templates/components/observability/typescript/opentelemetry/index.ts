import * as LlamaIndex from "@llamaindex/edge";
import * as traceloop from "@traceloop/node-server-sdk";

export const initObservability = () => {
  traceloop.initialize({
    appName: "llama-app",
    disableBatch: true,
    instrumentModules: {
      llamaIndex: LlamaIndex,
    },
  });
};
