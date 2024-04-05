import { MilvusVectorStore, VectorStoreIndex } from "llamaindex";
import { checkRequiredEnvVars, getMilvusClient } from "./shared";

export async function getDataSource() {
  checkRequiredEnvVars();
  const milvusClient = getMilvusClient();
  const store = new MilvusVectorStore({ milvusClient });

  return await VectorStoreIndex.fromVectorStore(store);
}
