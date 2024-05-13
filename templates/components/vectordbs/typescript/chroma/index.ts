/* eslint-disable turbo/no-undeclared-env-vars */
import { ChromaVectorStore, VectorStoreIndex } from "llamaindex";
import { checkRequiredEnvVars } from "./shared";

export async function getDataSource() {
  checkRequiredEnvVars();
  const chromaHost = process.env.CHROMA_HOST;
  const chromaPort = parseInt(process.env.CHROMA_PORT || "8000");
  const chromaUri = chromaHost
    ? `http://${chromaHost}:${chromaPort}`
    : undefined;

  const store = new ChromaVectorStore({
    collectionName: process.env.CHROMA_COLLECTION,
    chromaClientParams: chromaHost ? { path: chromaUri } : undefined,
  });

  return await VectorStoreIndex.fromVectorStore(store);
}
