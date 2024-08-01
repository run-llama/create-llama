import { VectorStoreIndex } from "llamaindex";
import { LlamaCloudIndex } from "llamaindex/cloud/LlamaCloudIndex";
import { getDataSource } from "../engine";
import { loadDocuments, saveDocument } from "./helper";
import { runPipeline } from "./pipeline";

export async function uploadDocument(
  currentIndex: VectorStoreIndex | LlamaCloudIndex,
  raw: string,
): Promise<string[]> {
  const [header, content] = raw.split(",");
  const mimeType = header.replace("data:", "").replace(";base64", "");
  const fileBuffer = Buffer.from(content, "base64");
  const documents = await loadDocuments(fileBuffer, mimeType);
  const { filename } = await saveDocument(fileBuffer, mimeType);
  const index = await getDataSource();

  // Update documents with metadata
  for (const document of documents) {
    document.metadata = {
      ...document.metadata,
      file_name: filename,
      private: "true", // to separate from other public documents
    };
  }

  return await runPipeline(index, documents);
}
