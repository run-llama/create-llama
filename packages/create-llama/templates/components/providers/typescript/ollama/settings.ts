import { Ollama, OllamaEmbedding } from "@llamaindex/ollama";
import { Settings } from "llamaindex";

export function initSettings() {
  const config = {
    host: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
  };
  Settings.llm = new Ollama({
    model: process.env.MODEL ?? "",
    config,
  });
  Settings.embedModel = new OllamaEmbedding({
    model: process.env.EMBEDDING_MODEL ?? "",
    config,
  });
}
