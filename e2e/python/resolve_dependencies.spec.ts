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

// TODO: add support for other templates

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

  test.describe("Mypy check", () => {
    test.describe.configure({ retries: 0 });

    // Test vector databases
    for (const vectorDb of vectorDbs) {
      test(`Mypy check for vectorDB: ${vectorDb}`, async () => {
        const cwd = await createTestDir();
        const { pyprojectPath } = await createAndCheckLlamaProject({
          options: {
            cwd,
            templateType: "streaming",
            templateFramework,
            dataSource: "--example-file",
            vectorDb,
            tools: "none",
            port: 3000,
            externalPort: 8000,
            postInstallAction: "none",
            templateUI: undefined,
            appType: "--no-frontend",
            llamaCloudProjectName: undefined,
            llamaCloudIndexName: undefined,
            observability: undefined,
          },
        });

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
      });
    }

    // Test tools
    for (const tool of toolOptions) {
      test(`Mypy check for tool: ${tool}`, async () => {
        const cwd = await createTestDir();
        const { pyprojectPath } = await createAndCheckLlamaProject({
          options: {
            cwd,
            templateType: "streaming",
            templateFramework,
            dataSource: "--example-file",
            vectorDb: "none",
            tools: tool,
            port: 3000,
            externalPort: 8000,
            postInstallAction: "none",
            templateUI: undefined,
            appType: "--no-frontend",
            llamaCloudProjectName: undefined,
            llamaCloudIndexName: undefined,
            observability: undefined,
          },
        });

        const pyprojectContent = fs.readFileSync(pyprojectPath, "utf-8");
        if (tool === "wikipedia.WikipediaToolSpec") {
          expect(pyprojectContent).toContain("wikipedia");
        }
        if (tool === "google.GoogleSearchToolSpec") {
          expect(pyprojectContent).toContain("google");
        }
      });
    }

    // Test data sources
    for (const dataSource of dataSources) {
      const dataSourceType = dataSource.split(" ")[0];
      test(`Mypy check for data source: ${dataSourceType}`, async () => {
        const cwd = await createTestDir();
        const { pyprojectPath } = await createAndCheckLlamaProject({
          options: {
            cwd,
            templateType: "streaming",
            templateFramework,
            dataSource,
            vectorDb: "none",
            tools: "none",
            port: 3000,
            externalPort: 8000,
            postInstallAction: "none",
            templateUI: undefined,
            appType: "--no-frontend",
            llamaCloudProjectName: undefined,
            llamaCloudIndexName: undefined,
            observability: undefined,
          },
        });

        const pyprojectContent = fs.readFileSync(pyprojectPath, "utf-8");
        if (dataSource.includes("--web-source")) {
          expect(pyprojectContent).toContain("llama-index-readers-web");
        }
        if (dataSource.includes("--db-source")) {
          expect(pyprojectContent).toContain("llama-index-readers-database");
        }
      });
    }

    // Test observability options
    for (const observability of observabilityOptions) {
      test(`Mypy check for observability: ${observability}`, async () => {
        const cwd = await createTestDir();

        const { pyprojectPath } = await createAndCheckLlamaProject({
          options: {
            cwd,
            templateType: "streaming",
            templateFramework,
            dataSource: "--example-file",
            vectorDb: "none",
            tools: "none",
            port: 3000,
            externalPort: 8000,
            postInstallAction: "none",
            templateUI: undefined,
            appType: "--no-frontend",
            llamaCloudProjectName: undefined,
            llamaCloudIndexName: undefined,
            observability,
          },
        });
      });
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

  const env = {
    ...process.env,
    POETRY_VIRTUALENVS_IN_PROJECT: "true",
  };

  // Run poetry install
  try {
    const { stdout: installStdout, stderr: installStderr } = await execAsync(
      "poetry install",
      { cwd: projectPath, env },
    );
    console.log("poetry install stdout:", installStdout);
    console.error("poetry install stderr:", installStderr);
  } catch (error) {
    console.error("Error running poetry install:", error);
    throw error;
  }

  // Run poetry run mypy
  try {
    const { stdout: mypyStdout, stderr: mypyStderr } = await execAsync(
      "poetry run mypy .",
      { cwd: projectPath, env },
    );
    console.log("poetry run mypy stdout:", mypyStdout);
    console.error("poetry run mypy stderr:", mypyStderr);
  } catch (error) {
    console.error("Error running mypy:", error);
    throw error;
  }

  // If we reach this point without throwing an error, the test passes
  expect(true).toBeTruthy();

  return { pyprojectPath, projectPath };
}
