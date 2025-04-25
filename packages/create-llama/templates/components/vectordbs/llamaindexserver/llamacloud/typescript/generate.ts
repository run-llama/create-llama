import * as dotenv from "dotenv";
import "dotenv/config";
import * as fs from "fs/promises";
import { LLamaCloudFileService } from "llamaindex";
import * as path from "path";
import { getIndex } from "./app/data";
import { initSettings } from "./app/settings";

dotenv.config();

const REQUIRED_ENV_VARS = [
  "LLAMA_CLOUD_INDEX_NAME",
  "LLAMA_CLOUD_PROJECT_NAME",
  "LLAMA_CLOUD_API_KEY",
];

export function checkRequiredEnvVars() {
  const missingEnvVars = REQUIRED_ENV_VARS.filter((envVar) => {
    return !process.env[envVar];
  });

  if (missingEnvVars.length > 0) {
    console.log(
      `The following environment variables are required but missing: ${missingEnvVars.join(
        ", ",
      )}`,
    );
    throw new Error(
      `Missing environment variables: ${missingEnvVars.join(", ")}`,
    );
  }
}

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
  const index = await getIndex();
  // ensure the index is available or create a new one
  await index.ensureIndex({
    verbose: true,
    embedding: {
      type: "OPENAI_EMBEDDING",
      component: {
        api_key: process.env.OPENAI_API_KEY,
        model_name: "text-embedding-3-small",
      },
    },
  });

  const projectId = await index.getProjectId();
  const pipelineId = await index.getPipelineId();

  // walk through the data directory and upload each file to LlamaCloud
  for await (const filePath of walk("data")) {
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
  try {
    checkRequiredEnvVars();
    initSettings();
    await loadAndIndex();
    console.log("Finished generating storage.");
  } catch (error) {
    console.error("Error generating storage.", error);
  }
})();
