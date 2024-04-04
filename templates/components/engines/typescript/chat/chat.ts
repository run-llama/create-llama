import { ContextChatEngine, LLM } from "llamaindex";
import { getDataSource } from "./index";

export async function createChatEngine(llm: LLM) {
  const index = await getDataSource(llm);
  if (!index) {
    throw new Error(
      `StorageContext is empty - call 'npm run generate' to generate the storage first`,
    );
  }
  const retriever = index.asRetriever();
  retriever.similarityTopK = 3;

  return new ContextChatEngine({
    chatModel: llm,
    retriever,
  });
}
