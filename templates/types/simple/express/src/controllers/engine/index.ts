import { LLM, SimpleChatEngine } from "@llamaindex/edge";

export async function createChatEngine(llm: LLM) {
  return new SimpleChatEngine({
    llm,
  });
}
