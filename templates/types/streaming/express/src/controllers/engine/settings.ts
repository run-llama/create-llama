import {
  Anthropic,
  HuggingFaceEmbedding,
  Ollama,
  OllamaEmbedding,
  OpenAI,
  OpenAIEmbedding,
  Settings,
} from "llamaindex";
import { ALL_AVAILABLE_ANTHROPIC_MODELS } from "llamaindex/llm/anthropic";

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 20;

export const initSettings = async () => {
  // HINT: you can delete the initialization code for unused model providers
  console.log(`Using '${process.env.MODEL_PROVIDER}' model provider`);
  switch (process.env.MODEL_PROVIDER) {
    case "ollama":
      initOllama();
      break;
    case "anthropic":
      initAnthropic();
      break;
    default:
      initOpenAI();
      break;
  }
  Settings.chunkSize = CHUNK_SIZE;
  Settings.chunkOverlap = CHUNK_OVERLAP;
};

function initOpenAI() {
  Settings.llm = new OpenAI({
    model: process.env.MODEL ?? "gpt-3.5-turbo",
    maxTokens: 512,
  });
  Settings.embedModel = new OpenAIEmbedding({
    model: process.env.EMBEDDING_MODEL,
    dimensions: process.env.EMBEDDING_DIM
      ? parseInt(process.env.EMBEDDING_DIM)
      : undefined,
  });
}

function initOllama() {
  if (!process.env.MODEL || !process.env.EMBEDDING_MODEL) {
    throw new Error(
      "Using Ollama as model provider, 'MODEL' and 'EMBEDDING_MODEL' env variables must be set.",
    );
  }
  Settings.llm = new Ollama({
    model: process.env.MODEL ?? "",
  });
  Settings.embedModel = new OllamaEmbedding({
    model: process.env.EMBEDDING_MODEL ?? "",
  });
}

function initAnthropic() {
  if (!process.env.MODEL || !process.env.EMBEDDING_MODEL) {
    throw new Error(
      "Using Anthropic as model provider, 'MODEL' and 'EMBEDDING_MODEL' env variables must be set.",
    );
  }
  Settings.llm = new Anthropic({
    model: process.env.MODEL as keyof typeof ALL_AVAILABLE_ANTHROPIC_MODELS,
  });

  Settings.embedModel = new HuggingFaceEmbedding({
    modelType: process.env.EMBEDDING_MODEL,
  });
}
