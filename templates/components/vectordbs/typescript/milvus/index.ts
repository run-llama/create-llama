import { VectorStoreIndex } from "llamaindex";
import { MilvusVectorStore } from "llamaindex/vector-store/MilvusVectorStore";
import { checkRequiredEnvVars, getMilvusClient } from "./shared";

export async function getDataSource(params?: any) {
  checkRequiredEnvVars();
  const milvusClient = getMilvusClient();
  const store = new MilvusVectorStore({ milvusClient });

  return await VectorStoreIndex.fromVectorStore(store);
}
