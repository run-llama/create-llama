/* eslint-disable turbo/no-undeclared-env-vars */
import { MongoDBAtlasVectorSearch, VectorStoreIndex } from "llamaindex";
import { MongoClient } from "mongodb";
import { checkRequiredEnvVars } from "./shared";

export async function getDataSource() {
  checkRequiredEnvVars();
  const client = new MongoClient(process.env.MONGO_URI!);
  const store = new MongoDBAtlasVectorSearch({
    mongodbClient: client,
    dbName: process.env.MONGODB_DATABASE!,
    collectionName: process.env.MONGODB_VECTORS!,
    indexName: process.env.MONGODB_VECTOR_INDEX,
  });

  return await VectorStoreIndex.fromVectorStore(store);
}
