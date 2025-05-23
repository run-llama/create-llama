import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { z } from "zod";

export const workflowFactory = async () => {
  return agent({
    tools: [
      tool({
        name: "add",
        description: "Adds two numbers",
        parameters: z.object({ x: z.number(), y: z.number() }),
        execute: ({ x, y }) => x + y,
      }),
    ],
  });
};
