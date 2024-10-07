import { expect, test } from "@playwright/test";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { TemplateFramework, TemplateVectorDB } from "../../helpers/types";
import { RunCreateLlamaOptions, createTestDir, runCreateLlama } from "../utils";

const execAsync = util.promisify(exec);

const templateFramework: TemplateFramework = process.env.FRAMEWORK
  ? (process.env.FRAMEWORK as TemplateFramework)
  : "fastapi";
const dataSource: string = process.env.DATASOURCE
  ? process.env.DATASOURCE
  : "--example-file";

if (
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
    "document_generator",
    "artifact",
  ];

  const dataSources = [
    "--example-file",
    "--web-source https://www.example.com",
    "--db-source mysql+pymysql://user:pass@localhost:3306/mydb",
  ];

  const observabilityOptions = ["llamatrace", "traceloop"];

  // Run separate tests for each observability option to reduce CI runtime
  test.describe("Test resolve python dependencies with observability", () => {
    // Testing with streaming template, vectorDb: none, tools: none, and dataSource: --example-file
    for (const observability of observabilityOptions) {
      test(`observability: ${observability}`, async () => {
        const cwd = await createTestDir();

        await createAndCheckLlamaProject({
          options: {
            cwd,
            templateType: "streaming",
            templateFramework,
            dataSource,
            vectorDb: "none",
            tools: "none",
            port: 3000, // port, not used
            externalPort: 8000, // externalPort, not used
            postInstallAction: "none", // postInstallAction
            templateUI: undefined, // ui
            appType: "--no-frontend", // appType
            llamaCloudProjectName: undefined, // llamaCloudProjectName
            llamaCloudIndexName: undefined, // llamaCloudIndexName
            observability,
          },
        });
      });
    }
  });

  test.describe("Test resolve python dependencies", () => {
    for (const vectorDb of vectorDbs) {
      for (const tool of toolOptions) {
        for (const dataSource of dataSources) {
          const dataSourceType = dataSource.split(" ")[0];
          const toolDescription = tool === "none" ? "no tools" : tool;
          const optionDescription = `vectorDb: ${vectorDb}, ${toolDescription}, dataSource: ${dataSourceType}`;

          test(`options: ${optionDescription}`, async () => {
            const cwd = await createTestDir();

            const { pyprojectPath, projectPath } =
              await createAndCheckLlamaProject({
                options: {
                  cwd,
                  templateType: "streaming",
                  templateFramework,
                  dataSource,
                  vectorDb,
                  tools: tool,
                  port: 3000, // port, not used
                  externalPort: 8000, // externalPort, not used
                  postInstallAction: "none", // postInstallAction
                  templateUI: undefined, // ui
                  appType: "--no-frontend", // appType
                  llamaCloudProjectName: undefined, // llamaCloudProjectName
                  llamaCloudIndexName: undefined, // llamaCloudIndexName
                  observability: undefined, // observability
                },
              });

            // Additional checks for specific dependencies

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

async function createAndCheckLlamaProject({
  options,
}: {
  options: RunCreateLlamaOptions;
}): Promise<{ pyprojectPath: string; projectPath: string }> {
  const result = await runCreateLlama(options);
  const name = result.projectName;
  const projectPath = path.join(options.cwd, name);

  // Check if the app folder exists
  expect(fs.existsSync(projectPath)).toBeTruthy();

  // Check if pyproject.toml exists
  const pyprojectPath = path.join(projectPath, "pyproject.toml");
  expect(fs.existsSync(pyprojectPath)).toBeTruthy();

  // Run poetry lock
  try {
    const { stdout, stderr } = await execAsync(
      "poetry config virtualenvs.in-project true && poetry lock --no-update",
      { cwd: projectPath },
    );
    console.log("poetry lock stdout:", stdout);
    console.error("poetry lock stderr:", stderr);
  } catch (error) {
    console.error("Error running poetry lock:", error);
    throw error;
  }

  // Check if poetry.lock file was created
  expect(fs.existsSync(path.join(projectPath, "poetry.lock"))).toBeTruthy();

  return { pyprojectPath, projectPath };
}
