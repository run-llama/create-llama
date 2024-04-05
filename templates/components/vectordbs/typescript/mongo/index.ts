/* eslint-disable turbo/no-undeclared-env-vars */
import {
  LLM,
  MongoDBAtlasVectorSearch,
  serviceContextFromDefaults,
  VectorStoreIndex,
} from "llamaindex";
import { MongoClient } from "mongodb";
import { checkRequiredEnvVars, CHUNK_OVERLAP, CHUNK_SIZE } from "./shared";

export async function getDataSource(llm: LLM) {
  checkRequiredEnvVars();
  const client = new MongoClient(process.env.MONGO_URI!);
  const serviceContext = serviceContextFromDefaults({
    llm,
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const store = new MongoDBAtlasVectorSearch({
    mongodbClient: client,
    dbName: process.env.MONGODB_DATABASE!,
    collectionName: process.env.MONGODB_VECTORS!,
    indexName: process.env.MONGODB_VECTOR_INDEX,
  });

  return await VectorStoreIndex.fromVectorStore(store, serviceContext);
}
