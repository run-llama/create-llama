import { LlamaCloudIndex } from "llamaindex";

type LlamaCloudDataSourceParams = {
  llamaCloudPipeline?: {
    project: string;
    pipeline: string;
  };
};

export async function getIndex(params?: LlamaCloudDataSourceParams) {
  const { project, pipeline } = params?.llamaCloudPipeline ?? {};
  const projectName = project ?? process.env.LLAMA_CLOUD_PROJECT_NAME;
  const pipelineName = pipeline ?? process.env.LLAMA_CLOUD_INDEX_NAME;
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  if (!projectName || !pipelineName || !apiKey) {
    throw new Error(
      "LlamaCloud is not configured. Please set project, pipeline, and api key in the params or as environment variables.",
    );
  }
  const index = new LlamaCloudIndex({
    organizationId: process.env.LLAMA_CLOUD_ORGANIZATION_ID,
    name: pipelineName,
    projectName,
    apiKey,
    baseUrl: process.env.LLAMA_CLOUD_BASE_URL,
  });
  return index;
}
