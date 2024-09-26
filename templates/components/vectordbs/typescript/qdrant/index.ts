import * as dotenv from "dotenv";
import { VectorStoreIndex } from "llamaindex";
import { QdrantVectorStore } from "llamaindex/vector-store/QdrantVectorStore";
import { checkRequiredEnvVars, getQdrantClient } from "./shared";

dotenv.config();

export async function getDataSource(params?: any) {
  checkRequiredEnvVars();
  const collectionName = process.env.QDRANT_COLLECTION;
  const store = new QdrantVectorStore({
    collectionName,
    client: getQdrantClient(),
  });

  return await VectorStoreIndex.fromVectorStore(store);
}
