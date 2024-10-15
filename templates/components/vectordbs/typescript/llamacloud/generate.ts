import * as dotenv from "dotenv";
import * as fs from "fs/promises";
import { LLamaCloudFileService } from "llamaindex";
import * as path from "path";
import { getDataSource } from "./index";
import { DATA_DIR } from "./loader";
import { initSettings } from "./settings";
import { checkRequiredEnvVars } from "./shared";

dotenv.config();

async function* walk(dir: string): AsyncGenerator<string> {
  const directory = await fs.opendir(dir);

  for await (const dirent of directory) {
    const entryPath = path.join(dir, dirent.name);

    if (dirent.isDirectory()) {
      yield* walk(entryPath); // Recursively walk through directories
    } else if (dirent.isFile()) {
      yield entryPath; // Yield file paths
    }
  }
}

async function loadAndIndex() {
  const index = await getDataSource();
  // ensure the index is available or create a new one
  await index.ensureIndex({ verbose: true });
  const projectId = await index.getProjectId();
  const pipelineId = await index.getPipelineId();

  // walk through the data directory and upload each file to LlamaCloud
  for await (const filePath of walk(DATA_DIR)) {
    const buffer = await fs.readFile(filePath);
    const filename = path.basename(filePath);
    try {
      await LLamaCloudFileService.addFileToPipeline(
        projectId,
        pipelineId,
        new File([buffer], filename),
      );
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
  }

  console.log(`Successfully uploaded documents to LlamaCloud!`);
}

(async () => {
  checkRequiredEnvVars();
  initSettings();
  await loadAndIndex();
  console.log("Finished generating storage.");
})();
