/* eslint-disable turbo/no-undeclared-env-vars */
import { LlamaCloudIndex } from "llamaindex";
import { checkRequiredEnvVars } from "./shared";

export async function getDataSource() {
  checkRequiredEnvVars();
  const index = new LlamaCloudIndex({
    name: "default",
    projectName: "Default",
    baseUrl: process.env.LLAMA_CLOUD_BASE_URL,
    apiKey: process.env.LLAMA_CLOUD_API_KEY,
  });
  return index;
}
