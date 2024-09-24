/* eslint-disable turbo/no-undeclared-env-vars */
import { VectorStoreIndex } from "llamaindex";
import { PineconeVectorStore } from "llamaindex/vector-store/PineconeVectorStore";
import { checkRequiredEnvVars } from "./shared";

export async function getDataSource(params?: any) {
  checkRequiredEnvVars();
  const store = new PineconeVectorStore();
  return await VectorStoreIndex.fromVectorStore(store);
}
