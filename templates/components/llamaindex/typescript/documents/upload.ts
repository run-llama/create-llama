import { Document, LLamaCloudFileService, VectorStoreIndex } from "llamaindex";
import { LlamaCloudIndex } from "llamaindex/cloud/LlamaCloudIndex";
import fs from "node:fs/promises";
import path from "node:path";
import { DocumentFile } from "../streaming/annotations";
import { parseFile, storeFile } from "./helper";
import { runPipeline } from "./pipeline";

export async function uploadDocument(
  index: VectorStoreIndex | LlamaCloudIndex | null,
  name: string,
  raw: string,
): Promise<DocumentFile> {
  const [header, content] = raw.split(",");
  const mimeType = header.replace("data:", "").replace(";base64", "");
  const fileBuffer = Buffer.from(content, "base64");

  // Store file
  const fileMetadata = await storeFile(name, fileBuffer, mimeType);

  // If the file is csv and has codeExecutorTool, we don't need to index the file.
  if (mimeType === "text/csv" && (await hasCodeExecutorTool())) {
    return fileMetadata;
  }
  let documentIds: string[] = [];
  if (index instanceof LlamaCloudIndex) {
    // trigger LlamaCloudIndex API to upload the file and run the pipeline
    const projectId = await index.getProjectId();
    const pipelineId = await index.getPipelineId();
    try {
      documentIds = [
        await LLamaCloudFileService.addFileToPipeline(
          projectId,
          pipelineId,
          new File([fileBuffer], name, { type: mimeType }),
          { private: "true" },
        ),
      ];
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
  } else {
    // run the pipeline for other vector store indexes
    const documents: Document[] = await parseFile(
      fileBuffer,
      fileMetadata.name,
      mimeType,
    );
    documentIds = await runPipeline(index, documents);
  }

  // Update file metadata with document IDs
  fileMetadata.refs = documentIds;
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
