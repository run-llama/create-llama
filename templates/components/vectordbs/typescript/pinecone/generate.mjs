/* eslint-disable turbo/no-undeclared-env-vars */
import { VectorStoreIndex } from "@llamaindex/edge";
import { SimpleDirectoryReader } from "@llamaindex/edge/readers/SimpleDirectoryReader";
import { storageContextFromDefaults } from "@llamaindex/edge/storage/StorageContext";
import { PineconeVectorStore } from "@llamaindex/edge/storage/vectorStore/PineconeVectorStore";
import * as dotenv from "dotenv";
import { STORAGE_DIR, checkRequiredEnvVars } from "./shared.mjs";

dotenv.config();

async function loadAndIndex() {
  // load objects from storage and convert them into LlamaIndex Document objects
  const documents = await new SimpleDirectoryReader().loadData({
    directoryPath: STORAGE_DIR,
  });

  // create vector store
  const vectorStore = new PineconeVectorStore();

  // create index from all the Documentss and store them in Pinecone
  console.log("Start creating embeddings...");
  const storageContext = await storageContextFromDefaults({ vectorStore });
  await VectorStoreIndex.fromDocuments(documents, { storageContext });
  console.log(
    "Successfully created embeddings and save to your Pinecone index.",
  );
}

(async () => {
  checkRequiredEnvVars();
  await loadAndIndex();
  console.log("Finished generating storage.");
})();
