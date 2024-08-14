import { VectorStoreIndex } from "llamaindex";
import { LlamaCloudIndex } from "llamaindex/cloud/LlamaCloudIndex";
import { LLamaCloudFileService } from "../streaming/service";
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
    // @ts-ignore TODO: implement getProjectId in LITS
    const projectId = index.getProjectId();
    // @ts-ignore TODO: make getPipelineId public in LITS
    const pipelineId = index.getPipelineId();
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
  const documents = await storeAndParseFile(fileBuffer, mimeType);
  return runPipeline(index, documents);
}
