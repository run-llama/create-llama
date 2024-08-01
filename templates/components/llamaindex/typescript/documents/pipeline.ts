import {
  Document,
  IngestionPipeline,
  Settings,
  SimpleNodeParser,
  VectorStoreIndex,
} from "llamaindex";
import { LlamaCloudIndex } from "llamaindex/cloud/LlamaCloudIndex";

export async function runPipeline(
  currentIndex: VectorStoreIndex | LlamaCloudIndex,
  documents: Document[],
) {
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
    await currentIndex.insertNodes(nodes);
    currentIndex.storageContext.docStore.persist();
    console.log("Added nodes to the vector store.");
  }

  return documents.map((document) => document.id_);
}
