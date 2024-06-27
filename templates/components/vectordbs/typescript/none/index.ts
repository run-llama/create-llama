import { SimpleDocumentStore, TextNode, VectorStoreIndex } from "llamaindex";
import { storageContextFromDefaults } from "llamaindex/storage/StorageContext";
import { STORAGE_CACHE_DIR } from "./shared";

export async function getDataSource(nodes?: TextNode[]) {
  if (nodes && nodes.length > 0) {
    // the user send some local nodes, we create an index using them and
    // prefer that index over the server side index.
    // TODO: merge indexes, currently we prefer nodes that are send by the user
    return await VectorStoreIndex.init({
      nodes,
    });
  } else {
    return await getServerDataSource();
  }
}

async function getServerDataSource() {
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
  });
}
