import * as dotenv from "dotenv";
import { VectorStoreIndex } from "llamaindex";
import { QdrantVectorStore } from "llamaindex/storage/vectorStore/QdrantVectorStore";
import { checkRequiredEnvVars, getQdrantClient } from "./shared";

dotenv.config();

export async function getDataSource() {
  checkRequiredEnvVars();
  const collectionName = process.env.QDRANT_COLLECTION;
  const store = new QdrantVectorStore({
    collectionName,
    client: getQdrantClient(),
  });

  return await VectorStoreIndex.fromVectorStore(store);
}
