/* eslint-disable turbo/no-undeclared-env-vars */
import {
  ContextChatEngine,
  LLM,
  VectorStoreIndex,
  serviceContextFromDefaults,
} from "@llamaindex/edge";
import { MongoDBAtlasVectorSearch } from "@llamaindex/edge/storage/vectorStore/MongoDBAtlasVectorSearch";
import { MongoClient } from "mongodb";
import { CHUNK_OVERLAP, CHUNK_SIZE, checkRequiredEnvVars } from "./shared.mjs";

async function getDataSource(llm: LLM) {
  checkRequiredEnvVars();
  const client = new MongoClient(process.env.MONGO_URI!);
  const serviceContext = serviceContextFromDefaults({
    llm,
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const store = new MongoDBAtlasVectorSearch({
    mongodbClient: client,
    dbName: process.env.MONGODB_DATABASE,
    collectionName: process.env.MONGODB_VECTORS,
    indexName: process.env.MONGODB_VECTOR_INDEX,
  });

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
