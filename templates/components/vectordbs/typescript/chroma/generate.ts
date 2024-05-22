/* eslint-disable turbo/no-undeclared-env-vars */
import * as dotenv from "dotenv";
import { VectorStoreIndex, storageContextFromDefaults } from "llamaindex";
import { ChromaVectorStore } from "llamaindex/storage/vectorStore/ChromaVectorStore";
import { getDocuments } from "./loader";
import { initSettings } from "./settings";
import { checkRequiredEnvVars } from "./shared";

dotenv.config();

async function loadAndIndex() {
  // load objects from storage and convert them into LlamaIndex Document objects
  const documents = await getDocuments();

  // create vector store
  const chromaUri = `http://${process.env.CHROMA_HOST}:${process.env.CHROMA_PORT}`;

  const vectorStore = new ChromaVectorStore({
    collectionName: process.env.CHROMA_COLLECTION,
    chromaClientParams: { path: chromaUri },
  });

  // create index from all the Documentss and store them in Pinecone
  console.log("Start creating embeddings...");
  const storageContext = await storageContextFromDefaults({ vectorStore });
  await VectorStoreIndex.fromDocuments(documents, { storageContext });
  console.log(
    "Successfully created embeddings and save to your ChromaDB index.",
  );
}

(async () => {
  checkRequiredEnvVars();
  initSettings();
  await loadAndIndex();
  console.log("Finished generating storage.");
})();
