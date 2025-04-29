import { MongoDBAtlasVectorSearch } from "@llamaindex/mongodb";
import { VectorStoreIndex } from "llamaindex";
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
    indexedMetadataFields: POPULATED_METADATA_FIELDS,
    embeddingDefinition: {
      dimensions: process.env.EMBEDDING_DIM
        ? parseInt(process.env.EMBEDDING_DIM)
        : 1536,
    },
  });

  return await VectorStoreIndex.fromVectorStore(store);
}
