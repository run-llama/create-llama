import {
  Document,
  IngestionPipeline,
  Settings,
  SimpleNodeParser,
  VectorStoreIndex,
} from "llamaindex";

export async function runPipeline(
  currentIndex: VectorStoreIndex,
  documents: Document[],
) {
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
  return documents.map((document) => document.id_);
}
