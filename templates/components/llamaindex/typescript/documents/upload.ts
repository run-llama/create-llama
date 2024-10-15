import { Document, LLamaCloudFileService, VectorStoreIndex } from "llamaindex";
import { LlamaCloudIndex } from "llamaindex/cloud/LlamaCloudIndex";
import fs from "node:fs/promises";
import path from "node:path";
import { FileMetadata, parseFile, storeFile } from "./helper";
import { runPipeline } from "./pipeline";

export async function uploadDocument(
  index: VectorStoreIndex | LlamaCloudIndex | null,
  filename: string,
  raw: string,
): Promise<FileMetadata> {
  const [header, content] = raw.split(",");
  const mimeType = header.replace("data:", "").replace(";base64", "");
  const fileBuffer = Buffer.from(content, "base64");

  // Store file
  const fileMetadata = await storeFile(filename, fileBuffer, mimeType);

  // If the file is csv and has codeExecutorTool, we don't need to index the file.
  if (mimeType === "text/csv" && (await hasCodeExecutorTool())) {
    return fileMetadata;
  }

  if (index instanceof LlamaCloudIndex) {
    // trigger LlamaCloudIndex API to upload the file and run the pipeline
    const projectId = await index.getProjectId();
    const pipelineId = await index.getPipelineId();
    try {
      const documentId = await LLamaCloudFileService.addFileToPipeline(
        projectId,
        pipelineId,
        new File([fileBuffer], filename, { type: mimeType }),
        { private: "true" },
      );
      // Update file metadata with document IDs
      fileMetadata.refs = [documentId];
      return fileMetadata;
    } catch (error) {
      if (
        error instanceof ReferenceError &&
        error.message.includes("File is not defined")
      ) {
        throw new Error(
          "File class is not supported in the current Node.js version. Please use Node.js 20 or higher.",
        );
      }
      throw error;
    }
  }

  // run the pipeline for other vector store indexes
  const documents: Document[] = await parseFile(fileBuffer, filename, mimeType);
  // Update file metadata with document IDs
  fileMetadata.refs = documents.map((document) => document.id_ as string);
  // Run the pipeline
  await runPipeline(index, documents);
  return fileMetadata;
}

const hasCodeExecutorTool = async () => {
  const codeExecutorTools = ["interpreter", "artifact"];

  const configFile = path.join("config", "tools.json");
  const toolConfig = JSON.parse(await fs.readFile(configFile, "utf8"));

  const localTools = toolConfig.local || {};
  // Check if local tools contains codeExecutorTools
  return codeExecutorTools.some((tool) => localTools[tool] !== undefined);
};
