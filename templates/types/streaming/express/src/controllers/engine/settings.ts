import { OpenAI, OpenAIEmbedding, Settings } from "llamaindex";

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 20;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL;

export const initSettings = async () => {
  Settings.llm = new OpenAI({
    model: process.env.MODEL ?? "gpt-3.5-turbo",
    maxTokens: 512,
  });
  Settings.chunkSize = CHUNK_SIZE;
  Settings.chunkOverlap = CHUNK_OVERLAP;
  Settings.embedModel = new OpenAIEmbedding({
    model: EMBEDDING_MODEL,
  });
};
