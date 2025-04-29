import { PineconeVectorStore } from "@llamaindex/pinecone";
import { VectorStoreIndex } from "llamaindex";
import { checkRequiredEnvVars } from "./shared";

export async function getDataSource(params?: any) {
  checkRequiredEnvVars();
  const store = new PineconeVectorStore();
  return await VectorStoreIndex.fromVectorStore(store);
}
