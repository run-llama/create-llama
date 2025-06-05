import { OpenAI } from "@llamaindex/openai";
import { LlamaIndexServer } from "@llamaindex/server";
import { agent } from "@llamaindex/workflow";
import { Settings, tool } from "llamaindex";
import { z } from "zod";

Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

const weatherAgent = agent({
  tools: [
    tool({
      name: "weather",
      description: "Get the weather in a given city",
      parameters: z.object({ city: z.string() }),
      execute: ({ city }) => `The weather in ${city} is sunny`,
    }),
  ],
});

new LlamaIndexServer({
  workflow: () => weatherAgent,
  uiConfig: {
    starterQuestions: [
      "What is the weather in Tokyo?",
      "What is the weather in Ho Chi Minh City?",
    ],
    layoutDir: "layout",
  },
  port: 3000,
}).start();
