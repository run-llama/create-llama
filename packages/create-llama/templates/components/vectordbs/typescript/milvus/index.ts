import { MilvusVectorStore } from "@llamaindex/milvus";
import { VectorStoreIndex } from "llamaindex";
import { checkRequiredEnvVars, getMilvusClient } from "./shared";

export async function getDataSource(params?: any) {
  checkRequiredEnvVars();
  const milvusClient = getMilvusClient();
  const store = new MilvusVectorStore({ milvusClient });

  return await VectorStoreIndex.fromVectorStore(store);
}
