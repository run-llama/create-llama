import { Settings, SimpleChatEngine } from "llamaindex";

export async function createChatEngine(documentIds?: string[]) {
  return new SimpleChatEngine({
    llm: Settings.llm,
  });
}
