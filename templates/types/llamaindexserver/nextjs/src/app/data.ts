import {
  SimpleDocumentStore,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "llamaindex";

export async function getIndex(params?: any) {
  const storageContext = await storageContextFromDefaults({
    persistDir: "storage",
  });

  // TODO: support storageContext.numDocs later
  const numberOfDocs = Object.keys(
    (storageContext.docStore as SimpleDocumentStore).toDict(),
  ).length;
  if (numberOfDocs === 0) {
    return null;
  }

  return await VectorStoreIndex.init({ storageContext });
}
