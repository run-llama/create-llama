import * as dotenv from "dotenv";
import { VectorStoreIndex } from "llamaindex";
import { checkRequiredEnvVars } from "./shared";

dotenv.config();

const DEFAULT_INDEX_NAME = "LlamaIndex";

export async function getDataSource(params?: any) {
  checkRequiredEnvVars();
  const indexName = process.env.WEAVIATE_INDEX_NAME || DEFAULT_INDEX_NAME;
  const store = null;
  // const store = new WeaviateVectorStore({
  //   collectionName,
  //   client: getWeaviateClient(),
  // });

  return await VectorStoreIndex.fromVectorStore(store);
}
