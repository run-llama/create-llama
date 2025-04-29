import { AstraDBVectorStore } from "@llamaindex/astra";
import * as dotenv from "dotenv";
import { VectorStoreIndex, storageContextFromDefaults } from "llamaindex";
import { getDocuments } from "./loader";
import { initSettings } from "./settings";
import { checkRequiredEnvVars } from "./shared";

dotenv.config();

async function loadAndIndex() {
  // load objects from storage and convert them into LlamaIndex Document objects
  const documents = await getDocuments();

  // create vector store and a collection
  const collectionName = process.env.ASTRA_DB_COLLECTION!;
  const vectorStore = new AstraDBVectorStore({
    params: {
      endpoint: process.env.ASTRA_DB_ENDPOINT!,
      token: process.env.ASTRA_DB_APPLICATION_TOKEN!,
    },
  });
  await vectorStore.createAndConnect(collectionName, {
    vector: {
      dimension: parseInt(process.env.EMBEDDING_DIM!),
      metric: "cosine",
    },
  });

  // create index from documents and store them in Astra
  console.log("Start creating embeddings...");
  const storageContext = await storageContextFromDefaults({ vectorStore });
  await VectorStoreIndex.fromDocuments(documents, { storageContext });
  console.log(
    "Successfully created embeddings and save to your Astra database.",
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
