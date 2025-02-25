import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import { Settings } from "llamaindex";

export function setupProvider() {
  // Map Azure OpenAI model names to OpenAI model names (only for TS)
  const AZURE_OPENAI_MODEL_MAP: Record<string, string> = {
    "gpt-35-turbo": "gpt-3.5-turbo",
    "gpt-35-turbo-16k": "gpt-3.5-turbo-16k",
    "gpt-4o": "gpt-4o",
    "gpt-4": "gpt-4",
    "gpt-4-32k": "gpt-4-32k",
    "gpt-4-turbo": "gpt-4-turbo",
    "gpt-4-turbo-2024-04-09": "gpt-4-turbo",
    "gpt-4-vision-preview": "gpt-4-vision-preview",
    "gpt-4-1106-preview": "gpt-4-1106-preview",
    "gpt-4o-2024-05-13": "gpt-4o-2024-05-13",
  };

  const azureConfig = {
    apiKey: process.env.AZURE_OPENAI_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiVersion:
      process.env.AZURE_OPENAI_API_VERSION || process.env.OPENAI_API_VERSION,
  };

  Settings.llm = new OpenAI({
    model:
      AZURE_OPENAI_MODEL_MAP[process.env.MODEL ?? "gpt-35-turbo"] ??
      "gpt-3.5-turbo",
    maxTokens: process.env.LLM_MAX_TOKENS
      ? Number(process.env.LLM_MAX_TOKENS)
      : undefined,
    azure: {
      ...azureConfig,
      deployment: process.env.AZURE_OPENAI_LLM_DEPLOYMENT,
    },
  });

  Settings.embedModel = new OpenAIEmbedding({
    model: process.env.EMBEDDING_MODEL,
    dimensions: process.env.EMBEDDING_DIM
      ? parseInt(process.env.EMBEDDING_DIM)
      : undefined,
    azure: {
      ...azureConfig,
      deployment: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    },
  });
}
