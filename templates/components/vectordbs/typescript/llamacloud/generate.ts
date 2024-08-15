import * as dotenv from "dotenv";
import { LLamaCloudFileService } from "llamaindex";
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
    console.log(
      `Adding file ${document.id_} to pipeline ${index.params.name} in project ${index.params.projectName}`,
    );
    await llamaCloudFileService.addFileToPipeline(
      projectId,
      pipelineId,
      document,
      { private: "false" },
    );
  }

  console.log(`Successfully created embeddings!`);
}

(async () => {
  checkRequiredEnvVars();
  initSettings();
  await loadAndIndex();
  console.log("Finished generating storage.");
})();
