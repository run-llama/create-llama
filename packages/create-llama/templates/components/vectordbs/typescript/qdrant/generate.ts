/* eslint-disable turbo/no-undeclared-env-vars */
import { QdrantVectorStore } from "@llamaindex/qdrant";
import * as dotenv from "dotenv";
import { VectorStoreIndex, storageContextFromDefaults } from "llamaindex";
import { getDocuments } from "./loader";
import { initSettings } from "./settings";
import { checkRequiredEnvVars, getQdrantClient } from "./shared";

dotenv.config();

const collectionName = process.env.QDRANT_COLLECTION;

async function loadAndIndex() {
  // load objects from storage and convert them into LlamaIndex Document objects
  const documents = await getDocuments();

  // Connect to Qdrant
  const vectorStore = new QdrantVectorStore({
    collectionName,
    client: getQdrantClient(),
  });

  const storageContext = await storageContextFromDefaults({ vectorStore });
  await VectorStoreIndex.fromDocuments(documents, {
    storageContext: storageContext,
  });
  console.log(
    `Successfully upload embeddings to Qdrant collection ${collectionName}.`,
  );
}

(async () => {
  try {
    checkRequiredEnvVars();
    initSettings();
    await loadAndIndex();
    console.log("Finished generating storage.");
  } catch (error) {
    console.error("Error generating storage.", error);
  }
})();
