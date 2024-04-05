/* eslint-disable turbo/no-undeclared-env-vars */
import { PineconeVectorStore, VectorStoreIndex } from "llamaindex";
import { checkRequiredEnvVars } from "./shared";

export async function getDataSource() {
  checkRequiredEnvVars();
  const store = new PineconeVectorStore();
  return await VectorStoreIndex.fromVectorStore(store);
}
