import {
  LLM,
  ContextChatEngine,
} from "llamaindex";
import { getDataSource } from "./index";

export async function createChatEngine(llm: LLM) {
  const index = await getDataSource(llm);
  const retriever = index.asRetriever();
  retriever.similarityTopK = 3;

  return new ContextChatEngine({
    chatModel: llm,
    retriever,
  });
}
