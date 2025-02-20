import {
  ALL_AVAILABLE_ANTHROPIC_MODELS,
  Anthropic,
} from "@llamaindex/anthropic";
import { HuggingFaceEmbedding } from "@llamaindex/huggingface";
import { Settings } from "llamaindex";

export function setupProvider() {
  const embedModelMap: Record<string, string> = {
    "all-MiniLM-L6-v2": "Xenova/all-MiniLM-L6-v2",
    "all-mpnet-base-v2": "Xenova/all-mpnet-base-v2",
  };
  Settings.llm = new Anthropic({
    model: process.env.MODEL as keyof typeof ALL_AVAILABLE_ANTHROPIC_MODELS,
  });
  Settings.embedModel = new HuggingFaceEmbedding({
    modelType: embedModelMap[process.env.EMBEDDING_MODEL!],
  });
}
