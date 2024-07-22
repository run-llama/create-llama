import { loadDocuments, saveDocument } from "./helper";
import { runPipeline } from "./pipeline";

export async function uploadDocument(raw: string): Promise<string[]> {
  const [header, content] = raw.split(",");
  const mimeType = header.replace("data:", "").replace(";base64", "");
  const fileBuffer = Buffer.from(content, "base64");
  const documents = await loadDocuments(fileBuffer, mimeType);
  const { filename } = await saveDocument(fileBuffer, mimeType);
  return await runPipeline(documents, filename);
}
