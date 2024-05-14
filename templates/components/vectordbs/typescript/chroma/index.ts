/* eslint-disable turbo/no-undeclared-env-vars */
import { VectorStoreIndex } from "llamaindex";
import { ChromaVectorStore } from "llamaindex/storage/vectorStore/ChromaVectorStore";
import { checkRequiredEnvVars } from "./shared";

export async function getDataSource() {
  checkRequiredEnvVars();
  const chromaUri = `http://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`;

  const store = new ChromaVectorStore({
    collectionName: process.env.CHROMA_COLLECTION,
    chromaClientParams: { path: chromaUri },
  });

  return await VectorStoreIndex.fromVectorStore(store);
}
