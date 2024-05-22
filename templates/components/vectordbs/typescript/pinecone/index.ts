/* eslint-disable turbo/no-undeclared-env-vars */
import { VectorStoreIndex } from "llamaindex";
import { PineconeVectorStore } from "llamaindex/storage/vectorStore/PineconeVectorStore";
import { checkRequiredEnvVars } from "./shared";

export async function getDataSource() {
  checkRequiredEnvVars();
  const store = new PineconeVectorStore();
  return await VectorStoreIndex.fromVectorStore(store);
}
