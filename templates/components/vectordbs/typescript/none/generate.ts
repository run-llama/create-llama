import { VectorStoreIndex } from "llamaindex";
import { storageContextFromDefaults } from "llamaindex/storage/StorageContext";

import * as dotenv from "dotenv";

import { getDocuments } from "./loader";
import { initSettings } from "./settings";
import { STORAGE_CACHE_DIR } from "./shared";

// Load environment variables from local .env file
dotenv.config();

async function getRuntime(func: any) {
  const start = Date.now();
  await func();
  const end = Date.now();
  return end - start;
}

async function generateDatasource() {
  console.log(`Generating storage context...`);
  // Split documents, create embeddings and store them in the storage context
  const ms = await getRuntime(async () => {
    const storageContext = await storageContextFromDefaults({
      persistDir: STORAGE_CACHE_DIR,
    });
    const documents = await getDocuments();
    //  Set private=false to mark the document as public (required for filtering)
    documents.forEach((doc) => {
      doc.metadata["private"] = "false";
    });

    await VectorStoreIndex.fromDocuments(documents, {
      storageContext,
    });
  });
  console.log(`Storage context successfully generated in ${ms / 1000}s.`);
}

(async () => {
  initSettings();
  await generateDatasource();
  console.log("Finished generating storage.");
})();
