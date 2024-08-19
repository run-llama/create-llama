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

  const documents = await getDocuments();
  for (const document of documents) {
    const buffer = await fs.promises.readFile(document.metadata.file_path);
    const file = new File([buffer], document.metadata.file_name);
    await LLamaCloudFileService.addFileToPipeline(projectId, pipelineId, file, {
      private: "false",
    });
  }

  console.log(`Successfully uploaded documents to LlamaCloud!`);
}

(async () => {
  checkRequiredEnvVars();
  initSettings();
  await loadAndIndex();
  console.log("Finished generating storage.");
})();
