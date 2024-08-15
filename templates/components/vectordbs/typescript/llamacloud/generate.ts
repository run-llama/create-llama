import * as dotenv from "dotenv";
import { LLamaCloudFileService } from "llamaindex";
import fs from "node:fs";
import { getDataSource } from "./index";
import { getDocuments } from "./loader";
import { initSettings } from "./settings";
import { checkRequiredEnvVars } from "./shared";

dotenv.config();

async function loadAndIndex() {
  const index = await getDataSource();
  const projectId = await index.getProjectId();
  const pipelineId = await index.getPipelineId();
  const llamaCloudFileService = new LLamaCloudFileService();

  const documents = await getDocuments();
  for (const document of documents) {
    const buffer = await fs.promises.readFile(document.metadata.file_path);
    const file = new File([buffer], document.metadata.file_name);
    await llamaCloudFileService.addFileToPipeline(projectId, pipelineId, file, {
      private: "false",
    });
  }

  console.log(`Successfully created embeddings!`);
}

(async () => {
  checkRequiredEnvVars();
  initSettings();
  await loadAndIndex();
  console.log("Finished generating storage.");
})();
