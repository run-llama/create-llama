import { ModelConfig } from "./types";

export const getGpt41ModelConfig = (): ModelConfig => ({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4.1",
  embeddingModel: "text-embedding-3-large",
  dimensions: 1536,
  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  },
});
