import { Settings, SimpleChatEngine } from "llamaindex";

export async function createChatEngine() {
  return new SimpleChatEngine({
    llm: Settings.llm,
  });
}
