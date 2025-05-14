import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { z } from "zod";

export const workflowFactory = async () => {
  return agent({
    tools: [
      tool({
        name: "weather",
        description: "Get the weather in a specific city",
        parameters: z.object({ city: z.string() }),
        execute: ({ city }) => `The weather in ${city} is sunny`,
      }),
    ],
  });
};
