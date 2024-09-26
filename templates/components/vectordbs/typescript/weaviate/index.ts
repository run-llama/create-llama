import * as dotenv from "dotenv";
import { VectorStoreIndex } from "llamaindex";
import { WeaviateVectorStore } from "llamaindex/vector-store/WeaviateVectorStore";
import { checkRequiredEnvVars, DEFAULT_INDEX_NAME } from "./shared";

dotenv.config();

export async function getDataSource(params?: any) {
  checkRequiredEnvVars();
  const indexName = process.env.WEAVIATE_INDEX_NAME || DEFAULT_INDEX_NAME;
  const store = new WeaviateVectorStore({ indexName });

  return await VectorStoreIndex.fromVectorStore(store);
}
