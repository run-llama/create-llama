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
import { getDataSource } from "../../engine";

export async function runPipeline(
  documents: Document[],
  filename: string,
): Promise<string[]> {
  // mark documents to add to the vector store as private
  for (const document of documents) {
    document.metadata = {
      ...document.metadata,
      file_name: filename,
      private: true,
    };
  }

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
  await addNodesToVectorStore(nodes);
  return documents.map((document) => document.id_);
}

async function addNodesToVectorStore(nodes: BaseNode<Metadata>[]) {
  let currentIndex = await getDataSource(); // always not null with an vectordb
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
