/* eslint-disable turbo/no-undeclared-env-vars */
import {
  LLM,
  PineconeVectorStore,
  VectorStoreIndex,
  serviceContextFromDefaults,
} from "llamaindex";
import { CHUNK_OVERLAP, CHUNK_SIZE, checkRequiredEnvVars } from "./shared";

export async function getDataSource(llm: LLM) {
  checkRequiredEnvVars();
  const serviceContext = serviceContextFromDefaults({
    llm,
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const store = new PineconeVectorStore();
  return await VectorStoreIndex.fromVectorStore(store, serviceContext);
}
