import { ContextChatEngine, Settings } from "llamaindex";
import { getDataSource } from "./index";

export async function createChatEngine() {
  const index = await getDataSource();
  if (!index) {
    throw new Error(
      `StorageContext is empty - call 'npm run generate' to generate the storage first`,
    );
  }
  const retriever = index.asRetriever();
  retriever.similarityTopK = 3;

  return new ContextChatEngine({
    chatModel: Settings.llm,
    retriever,
  });
}
