/* eslint-disable turbo/no-undeclared-env-vars */
import { VectorStoreIndex } from "llamaindex";
import { AstraDBVectorStore } from "llamaindex/storage/vectorStore/AstraDBVectorStore";
import { checkRequiredEnvVars } from "./shared";

export async function getDataSource() {
  checkRequiredEnvVars();
  const store = new AstraDBVectorStore();
  await store.connect(process.env.ASTRA_DB_COLLECTION!);
  return await VectorStoreIndex.fromVectorStore(store);
}
