import {
  LLM,
  serviceContextFromDefaults,
  SimpleDocumentStore,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "llamaindex";
import { CHUNK_OVERLAP, CHUNK_SIZE, STORAGE_CACHE_DIR } from "./shared";

export async function getDataSource(llm: LLM) {
  const serviceContext = serviceContextFromDefaults({
    llm,
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });
  const storageContext = await storageContextFromDefaults({
    persistDir: `${STORAGE_CACHE_DIR}`,
  });

  const numberOfDocs = Object.keys(
    (storageContext.docStore as SimpleDocumentStore).toDict(),
  ).length;
  if (numberOfDocs === 0) {
    return null;
  }
  return await VectorStoreIndex.init({
    storageContext,
    serviceContext,
  });
}
