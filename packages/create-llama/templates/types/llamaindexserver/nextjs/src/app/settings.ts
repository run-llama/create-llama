import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import { Settings } from "llamaindex";

export function initSettings() {
  Settings.llm = new OpenAI({
    model: "gpt-4o-mini",
  });
  Settings.embedModel = new OpenAIEmbedding({
    model: "text-embedding-3-small",
  });
}
