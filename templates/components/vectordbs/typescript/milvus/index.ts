/* eslint-disable turbo/no-undeclared-env-vars */
import {
  ContextChatEngine,
  LLM,
  MilvusVectorStore,
  serviceContextFromDefaults,
  VectorStoreIndex,
} from "llamaindex";
import {
  checkRequiredEnvVars,
  getMilvusClient,
  CHUNK_OVERLAP,
  CHUNK_SIZE,
} from "./shared.mjs";

async function getDataSource(llm: LLM) {
  checkRequiredEnvVars();
  const serviceContext = serviceContextFromDefaults({
    llm,
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const milvusClient = getMilvusClient();
  const store = new MilvusVectorStore({ milvusClient });
  await store.connect(process.env.MILVUS_COLLECTION);

  return await VectorStoreIndex.fromVectorStore(store, serviceContext);
}

export async function createChatEngine(llm: LLM) {
  const index = await getDataSource(llm);
  const retriever = index.asRetriever({ similarityTopK: 3 });
  return new ContextChatEngine({
    chatModel: llm,
    retriever,
  });
}
