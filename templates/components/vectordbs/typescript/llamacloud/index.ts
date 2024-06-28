import { LlamaCloudIndex } from "llamaindex/cloud/LlamaCloudIndex";
import { checkRequiredEnvVars } from "./shared";

export async function getDataSource() {
  checkRequiredEnvVars();
  const index = new LlamaCloudIndex({
    name: process.env.LLAMA_CLOUD_INDEX_NAME!,
    projectName: process.env.LLAMA_CLOUD_PROJECT_NAME!,
    apiKey: process.env.LLAMA_CLOUD_API_KEY,
    baseUrl: process.env.LLAMA_CLOUD_BASE_URL,
  });
  return index;
}
