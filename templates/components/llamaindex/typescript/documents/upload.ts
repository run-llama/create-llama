import { LLamaCloudFileService, VectorStoreIndex } from "llamaindex";
import { LlamaCloudIndex } from "llamaindex/cloud/LlamaCloudIndex";
import { storeAndParseFile } from "./helper";
import { runPipeline } from "./pipeline";

export async function uploadDocument(
  index: VectorStoreIndex | LlamaCloudIndex,
  filename: string,
  raw: string,
): Promise<string[]> {
  const [header, content] = raw.split(",");
  const mimeType = header.replace("data:", "").replace(";base64", "");
  const fileBuffer = Buffer.from(content, "base64");

  if (index instanceof LlamaCloudIndex) {
    // trigger LlamaCloudIndex API to upload the file and run the pipeline
    const projectId = await index.getProjectId();
    const pipelineId = await index.getPipelineId();
    return [
      await LLamaCloudFileService.addFileToPipeline(
        projectId,
        pipelineId,
        new File([fileBuffer], filename, { type: mimeType }),
        { private: "true" },
      ),
    ];
  }

  // run the pipeline for other vector store indexes
  const documents = await storeAndParseFile(filename, fileBuffer, mimeType);
  return runPipeline(index, documents);
}
