import { Document } from "llamaindex";
import { getDataSource } from "../../engine";

export async function runPipeline(documents: Document[], filename: string) {
  const currentIndex = await getDataSource();
  for (const document of documents) {
    document.metadata = {
      ...document.metadata,
      file_name: filename,
      private: true, // mark document as private
      use_local_url: true, // mark use local url to display the document
    };
    await currentIndex.insert(document);
  }
  return documents.map((document) => document.id_);
}
