/* eslint-disable turbo/no-undeclared-env-vars */
import * as dotenv from "dotenv";
import {
  VectorStoreIndex,
  WeaviateVectorStore,
  storageContextFromDefaults,
} from "llamaindex";
import { getDocuments } from "./loader";
import { initSettings } from "./settings";
import { DEFAULT_INDEX_NAME, checkRequiredEnvVars } from "./shared";
dotenv.config();

async function loadAndIndex() {
  const indexName = process.env.WEAVIATE_INDEX_NAME || DEFAULT_INDEX_NAME;

  // load objects from storage and convert them into LlamaIndex Document objects
  const documents = await getDocuments();

  const vectorStore = new WeaviateVectorStore({ indexName });

  const storageContext = await storageContextFromDefaults({ vectorStore });
  await VectorStoreIndex.fromDocuments(documents, {
    storageContext: storageContext,
  });
  console.log(`Successfully upload embeddings to Weaviate index ${indexName}.`);
}

(async () => {
  checkRequiredEnvVars();
  initSettings();
  await loadAndIndex();
  console.log("Finished generating storage.");
})();
