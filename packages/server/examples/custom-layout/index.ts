import { LlamaIndexServer } from "@llamaindex/server";
import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { z } from "zod";

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
    appTitle: "Weather App",
    starterQuestions: ["What is the weather in Tokyo?"],
  },
  port: 3000,
}).start();
