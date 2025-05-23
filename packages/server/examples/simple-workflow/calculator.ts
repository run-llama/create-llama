import { LlamaIndexServer } from "@llamaindex/server";
import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { z } from "zod";

const calculatorAgent = agent({
  tools: [
    tool({
      name: "add",
      description: "Adds two numbers",
      parameters: z.object({ x: z.number(), y: z.number() }),
      execute: ({ x, y }) => x + y,
    }),
  ],
});

new LlamaIndexServer({
  workflow: () => calculatorAgent,
  uiConfig: {
    starterQuestions: ["1 + 1", "2 + 2"],
  },
  port: 3000,
}).start();
