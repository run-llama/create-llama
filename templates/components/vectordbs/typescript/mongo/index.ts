/* eslint-disable turbo/no-undeclared-env-vars */
import { VectorStoreIndex } from "llamaindex";
import { MongoDBAtlasVectorSearch } from "llamaindex/storage/vectorStore/MongoDBAtlasVectorStore";
import { MongoClient } from "mongodb";
import { checkRequiredEnvVars, POPULATED_METADATA_FIELDS } from "./shared";

export async function getDataSource(params?: any) {
  checkRequiredEnvVars();
  const client = new MongoClient(process.env.MONGODB_URI!);
  const store = new MongoDBAtlasVectorSearch({
    mongodbClient: client,
    dbName: process.env.MONGODB_DATABASE!,
    collectionName: process.env.MONGODB_VECTORS!,
    indexName: process.env.MONGODB_VECTOR_INDEX,
    populatedMetadataFields: POPULATED_METADATA_FIELDS,
  });

  return await VectorStoreIndex.fromVectorStore(store);
}
