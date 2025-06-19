import {
  ALL_AVAILABLE_MISTRAL_MODELS,
  MistralAI,
  MistralAIEmbedding,
  MistralAIEmbeddingModelType,
} from "@llamaindex/mistral";
import { Settings } from "llamaindex";

export function initSettings() {
  Settings.llm = new MistralAI({
    model: process.env.MODEL as keyof typeof ALL_AVAILABLE_MISTRAL_MODELS,
  });
  Settings.embedModel = new MistralAIEmbedding({
    model: process.env.EMBEDDING_MODEL as MistralAIEmbeddingModelType,
  });
}
