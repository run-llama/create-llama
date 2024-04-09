import * as dotenv from "dotenv";
import { QdrantVectorStore, VectorStoreIndex } from "llamaindex";
import { checkRequiredEnvVars, getQdrantClient } from "./shared";

dotenv.config();

export async function getDataSource() {
  checkRequiredEnvVars();
  const collectionName = process.env.QDRANT_COLLECTION;
  const store = new QdrantVectorStore(collectionName, getQdrantClient());

  return await VectorStoreIndex.fromVectorStore(store);
}
