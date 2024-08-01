import { LlamaCloudIndex } from "llamaindex/cloud/LlamaCloudIndex";
import { LLamaCloudFileService } from "../llamaindex/streaming/service";

export async function getDataSource() {
  const { project, pipeline } = LLamaCloudFileService.getConfig() || {};
  const projectName = project || process.env.LLAMA_CLOUD_PROJECT_NAME;
  const pipelineName = pipeline || process.env.LLAMA_CLOUD_INDEX_NAME;
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!projectName || !pipelineName || !apiKey) {
    throw new Error(
      "Set project, pipeline, and api key in the config file or as environment variables.",
    );
  }
  const index = new LlamaCloudIndex({
    name: pipelineName,
    projectName,
    apiKey,
    baseUrl: process.env.LLAMA_CLOUD_BASE_URL,
  });
  return index;
}
