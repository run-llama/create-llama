import { ModelConfig } from "./types";

export const getGpt41ModelConfig = (openAiKey?: string): ModelConfig => ({
  provider: "openai",
  apiKey: openAiKey,
  model: "gpt-4.1",
  embeddingModel: "text-embedding-3-large",
  dimensions: 1536,
  isConfigured(): boolean {
    return !!openAiKey;
  },
});
