import { expect, test } from "@playwright/test";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { TemplateFramework, TemplateVectorDB } from "../helpers/types";
import { createTestDir, runCreateLlama } from "./utils";

const execAsync = util.promisify(exec);

const templateFramework: TemplateFramework = process.env.FRAMEWORK
  ? (process.env.FRAMEWORK as TemplateFramework)
  : "fastapi";
const dataSource: string = process.env.DATASOURCE
  ? process.env.DATASOURCE
  : "--example-file";

if (
  templateFramework == "fastapi" && // test is only relevant for fastapi
  process.version.startsWith("v20.") && // XXX: Only run for Node.js version 20 (CI matrix will trigger other versions)
  dataSource === "--example-file" // XXX: this test provides its own data source - only trigger it on one data source (usually the CI matrix will trigger multiple data sources)
) {
  // vectorDBs, tools, and data source combinations to test
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

  const dataSources = [
    "--example-file",
    "--web-source https://www.example.com",
    "--db-source mysql+pymysql://user:pass@localhost:3306/mydb",
  ];

  test.describe("Test resolve python dependencies", () => {
    for (const vectorDb of vectorDbs) {
      for (const tool of toolOptions) {
        for (const dataSource of dataSources) {
          const dataSourceType = dataSource.split(" ")[0];
          const optionDescription = `vectorDb: ${vectorDb}, tools: ${tool}, dataSource: ${dataSourceType}`;

          test(`options: ${optionDescription}`, async () => {
            const cwd = await createTestDir();

            const result = await runCreateLlama({
              cwd,
              templateType: "streaming",
              templateFramework: "fastapi",
              dataSource,
              vectorDb,
              port: 3000, // port
              externalPort: 8000, // externalPort
              postInstallAction: "none", // postInstallAction
              templateUI: undefined, // ui
              appType: "--no-frontend", // appType
              llamaCloudProjectName: undefined, // llamaCloudProjectName
              llamaCloudIndexName: undefined, // llamaCloudIndexName
              tools: tool,
            });
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

            // Check for data source specific dependencies
            if (dataSource.includes("--web-source")) {
              expect(pyprojectContent).toContain("llama-index-readers-web");
            }
            if (dataSource.includes("--db-source")) {
              expect(pyprojectContent).toContain(
                "llama-index-readers-database ",
              );
            }
          });
        }
      }
    }
  });
}
