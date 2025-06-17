import {
  Gemini,
  GEMINI_EMBEDDING_MODEL,
  GEMINI_MODEL,
  GeminiEmbedding,
} from "@llamaindex/google";
import { Settings } from "llamaindex";

export function initSettings() {
  Settings.llm = new Gemini({
    model: process.env.MODEL as GEMINI_MODEL,
  });
  Settings.embedModel = new GeminiEmbedding({
    model: process.env.EMBEDDING_MODEL as GEMINI_EMBEDDING_MODEL,
  });
}
