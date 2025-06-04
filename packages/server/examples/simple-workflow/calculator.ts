import { OpenAI } from "@llamaindex/openai";
import { LlamaIndexServer } from "@llamaindex/server";
import { agent } from "@llamaindex/workflow";
import { Settings, tool } from "llamaindex";
import { z } from "zod";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

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
