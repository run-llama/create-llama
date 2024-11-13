import {
  Document,
  IngestionPipeline,
  Settings,
  SimpleNodeParser,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "llamaindex";

const DEFAULT_CACHE_DIR = ".cache";

export async function runPipeline(
  currentIndex: VectorStoreIndex | null,
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
  if (currentIndex) {
    await currentIndex.insertNodes(nodes);
    currentIndex.storageContext.docStore.persist();
    console.log("Added nodes to the vector store.");
    return documents.map((document) => document.id_);
  } else {
    // Initialize a new index with the documents
    console.log(
      "Got empty index, created new index with the uploaded documents",
    );

    const storageContext = await storageContextFromDefaults({
      persistDir: DEFAULT_CACHE_DIR,
    });
    const newIndex = await VectorStoreIndex.fromDocuments(documents, {
      storageContext,
    });
    newIndex.storageContext.docStore.persist(DEFAULT_CACHE_DIR);
    return documents.map((document) => document.id_);
  }
}
