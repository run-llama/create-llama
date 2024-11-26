import { Settings, SimpleChatEngine } from "llamaindex";

export async function createChatEngine(params?: any) {
  return new SimpleChatEngine({
    llm: Settings.llm,
  });
}
