import {
  Ollama,
  OllamaEmbedding,
  OpenAI,
  OpenAIEmbedding,
  Settings,
} from "llamaindex";

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 20;

export const initSettings = async () => {
  // HINT: you can delete the initialization code for unused model providers
  console.log(`Using '${process.env.MODEL_PROVIDER}' model provider`);
  switch (process.env.MODEL_PROVIDER) {
    case "ollama":
      initOllama();
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
