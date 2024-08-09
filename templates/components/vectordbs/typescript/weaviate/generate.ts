/* eslint-disable turbo/no-undeclared-env-vars */
import * as dotenv from "dotenv";
import { VectorStoreIndex, storageContextFromDefaults } from "llamaindex";
import { getDocuments } from "./loader";
import { initSettings } from "./settings";
import { checkRequiredEnvVars } from "./shared";

dotenv.config();

const indexName = process.env.WEAVIATE_INDEX_NAME || "LlamaIndex";

async function loadAndIndex() {
  // load objects from storage and convert them into LlamaIndex Document objects
  const documents = await getDocuments();

  // Connect to Weaviate
  const vectorStore = null;
  // const vectorStore = new WeaviateVectorStore({
  //   indexName,
  //   client: getWeaviateClient(),
  // });

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
