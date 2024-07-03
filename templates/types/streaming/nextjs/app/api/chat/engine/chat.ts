import { Settings, SimpleChatEngine } from "llamaindex";

export async function createChatEngine(ids: string[]) {
  return new SimpleChatEngine({
    llm: Settings.llm,
  });
}
