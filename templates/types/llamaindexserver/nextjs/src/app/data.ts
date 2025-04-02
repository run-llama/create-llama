import {
  SimpleDocumentStore,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "llamaindex";

export async function getIndex(params?: any) {
  const storageContext = await storageContextFromDefaults({
    persistDir: "storage",
  });

  const numberOfDocs = Object.keys(
    (storageContext.docStore as SimpleDocumentStore).toDict(),
  ).length;
  if (numberOfDocs === 0) {
    throw new Error(
      "Index not found. Please run `pnpm run generate` to generate the embeddings of the documents",
    );
  }

  return await VectorStoreIndex.init({ storageContext });
}
