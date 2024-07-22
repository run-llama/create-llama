import {
  BaseNode,
  Document,
  IngestionPipeline,
  Metadata,
  Settings,
  SimpleNodeParser,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "llamaindex";
import { LlamaCloudIndex } from "llamaindex/cloud/LlamaCloudIndex";
import { getDataSource } from "../../engine";

export async function runPipeline(documents: Document[], filename: string) {
  const currentIndex = await getDataSource();

  // Update documents with metadata
  for (const document of documents) {
    document.metadata = {
      ...document.metadata,
      file_name: filename,
      private: "true", // to separate from other public documents
    };
  }

  if (currentIndex instanceof LlamaCloudIndex) {
    // LlamaCloudIndex processes the documents automatically
    // so we don't need ingestion pipeline, just insert the documents directly
    for (const document of documents) {
      await currentIndex.insert(document);
    }
  } else {
    // Use ingestion pipeline to process the documents into nodes and add them to the vector store
    const pipeline = new IngestionPipeline({
      transformations: [
        new SimpleNodeParser({
          chunkSize: Settings.chunkSize,
          chunkOverlap: Settings.chunkOverlap,
        }),
        Settings.embedModel,
      ],
    });
    const nodes = await pipeline.run({ documents });
    await addNodesToVectorStore(nodes, currentIndex);
  }

  return documents.map((document) => document.id_);
}

async function addNodesToVectorStore(
  nodes: BaseNode<Metadata>[],
  currentIndex: VectorStoreIndex | null,
) {
  if (currentIndex) {
    await currentIndex.insertNodes(nodes);
  } else {
    // Not using vectordb and haven't generated local index yet
    const storageContext = await storageContextFromDefaults({
      persistDir: "./cache",
    });
    currentIndex = await VectorStoreIndex.init({ nodes, storageContext });
  }
  currentIndex.storageContext.docStore.persist();
  console.log("Added nodes to the vector store.");
}
