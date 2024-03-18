import {
  ContextChatEngine,
  LLM,
  VectorStoreIndex,
  serviceContextFromDefaults,
} from "@llamaindex/edge";
import { MilvusVectorStore } from "@llamaindex/edge/storage/vectorStore/MilvusVectorStore";
import {
  CHUNK_OVERLAP,
  CHUNK_SIZE,
  checkRequiredEnvVars,
  getMilvusClient,
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
