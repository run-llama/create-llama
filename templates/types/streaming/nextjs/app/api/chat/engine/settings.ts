import { OpenAI, Settings } from "llamaindex";
import { CHUNK_OVERLAP, CHUNK_SIZE } from "./shared";

export const initSettings = async () => {
  Settings.llm = new OpenAI({
    model: (process.env.MODEL as any) ?? "gpt-3.5-turbo",
    maxTokens: 512,
  });
  Settings.chunkSize = CHUNK_SIZE;
  Settings.chunkOverlap = CHUNK_OVERLAP;
};
