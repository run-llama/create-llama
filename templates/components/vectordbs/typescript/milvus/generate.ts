/* eslint-disable turbo/no-undeclared-env-vars */
import * as dotenv from "dotenv";
import {
  MilvusVectorStore,
  VectorStoreIndex,
  storageContextFromDefaults,
} from "llamaindex";
import { getDocuments } from "./loader.mjs";
import { checkRequiredEnvVars, getMilvusClient } from "./shared.mjs";

dotenv.config();

const collectionName = process.env.MILVUS_COLLECTION;

async function loadAndIndex() {
  // load objects from storage and convert them into LlamaIndex Document objects
  const documents = await getDocuments();

  // Connect to Milvus
  const milvusClient = getMilvusClient();
  const vectorStore = new MilvusVectorStore({ milvusClient });

  // now create an index from all the Documents and store them in Milvus
  const storageContext = await storageContextFromDefaults({ vectorStore });
  await VectorStoreIndex.fromDocuments(documents, {
    storageContext: storageContext,
  });
  console.log(
    `Successfully created embeddings in the Milvus collection ${collectionName}.`,
  );
}

(async () => {
  checkRequiredEnvVars();
  await loadAndIndex();
  console.log("Finished generating storage.");
})();
