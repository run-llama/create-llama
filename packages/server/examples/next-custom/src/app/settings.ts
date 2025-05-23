import { OpenAI } from "@llamaindex/openai";
import { Settings } from "llamaindex";

export function initSettings() {
  Settings.llm = new OpenAI({
    model: "gpt-4.1",
  });
}
