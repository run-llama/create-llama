import { expect, test } from "@playwright/test";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { TemplateVectorDB } from "../helpers/types";
import { createTestDir, runCreateLlama } from "./utils";

const execAsync = util.promisify(exec);

const vectorDbs: TemplateVectorDB[] = [
  "mongo",
  "pg",
  "pinecone",
  "milvus",
  "astra",
  "qdrant",
  "chroma",
  "weaviate",
];

const toolOptions = [
  "wikipedia.WikipediaToolSpec",
  "google.GoogleSearchToolSpec",
];

// TODO: Add data sources to the test

test.describe("Test resolve python dependencies", () => {
  for (const vectorDb of vectorDbs) {
    for (const tool of toolOptions) {
      const optionDescription = `vectorDb: ${vectorDb}, tools: ${tool}`;

      test(`options: ${optionDescription}`, async () => {
        const cwd = await createTestDir();

        const result = await runCreateLlama(
          cwd,
          "streaming",
          "fastapi",
          "--example-file",
          vectorDb,
          3000, // port
          8000, // externalPort
          "none", // postInstallAction
          undefined, // ui
          "--no-frontend", // appType
          undefined, // llamaCloudProjectName
          undefined, // llamaCloudIndexName
          tool,
        );
        const name = result.projectName;

        // Check if the app folder exists
        const dirExists = fs.existsSync(path.join(cwd, name));
        expect(dirExists).toBeTruthy();

        // Check if pyproject.toml exists
        const pyprojectPath = path.join(cwd, name, "pyproject.toml");
        const pyprojectExists = fs.existsSync(pyprojectPath);
        expect(pyprojectExists).toBeTruthy();

        // Run poetry lock
        try {
          const { stdout, stderr } = await execAsync(
            // Config poetry to create virtualenv in project directory.
            // so that we can easily prune the e2e cache to avoid overloading the storage.
            "poetry config virtualenvs.in-project true && poetry lock --no-update",
            {
              cwd: path.join(cwd, name),
            },
          );
          console.log("poetry lock stdout:", stdout);
          console.error("poetry lock stderr:", stderr);
        } catch (error) {
          console.error("Error running poetry lock:", error);
          throw error;
        }

        // Check if poetry.lock file was created
        const poetryLockExists = fs.existsSync(
          path.join(cwd, name, "poetry.lock"),
        );
        expect(poetryLockExists).toBeTruthy();

        // Verify that specific dependencies are in pyproject.toml
        const pyprojectContent = fs.readFileSync(pyprojectPath, "utf-8");
        if (vectorDb !== "none") {
          if (vectorDb === "pg") {
            expect(pyprojectContent).toContain(
              "llama-index-vector-stores-postgres",
            );
          } else {
            expect(pyprojectContent).toContain(
              `llama-index-vector-stores-${vectorDb}`,
            );
          }
        }
        if (tool !== "none") {
          if (tool === "wikipedia.WikipediaToolSpec") {
            expect(pyprojectContent).toContain("wikipedia");
          }
          if (tool === "google.GoogleSearchToolSpec") {
            expect(pyprojectContent).toContain("google");
          }
        }
      });
    }
  }
});
