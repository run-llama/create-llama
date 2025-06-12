import { expect, test } from "@playwright/test";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { TemplateFramework, TemplateType, TemplateUseCase, TemplateVectorDB } from "../../helpers/types";
import { RunCreateLlamaOptions, createTestDir, runCreateLlama } from "../utils";

const execAsync = util.promisify(exec);

const templateFramework: TemplateFramework = process.env.FRAMEWORK
  ? (process.env.FRAMEWORK as TemplateFramework)
  : "fastapi";
const templateType: TemplateType = process.env.TEMPLATE_TYPE
  ? (process.env.TEMPLATE_TYPE as TemplateType)
  : "llamaindexserver";
const useCases: TemplateUseCase[] = [
  "agentic_rag",
  "deep_research",
  "financial_report",
  "code_generator",
  "document_generator",
  "hitl",
];
const dataSource: string = process.env.DATASOURCE
  ? process.env.DATASOURCE
  : "--example-file";

test.describe("Mypy check", () => {
  test.describe.configure({ retries: 0 });

    // Test for streaming template
    test.describe("StreamingTemplate", () => {
      test.skip(templateType !== "streaming", `skipping streaming test for ${templateType}`);
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

        // Test vector databases
        for (const vectorDb of vectorDbs) {
          test(`vectorDB: ${vectorDb} ${templateType}`, async () => {
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

        // // Test tools
        for (const tool of toolOptions) {
          test(`tool: ${tool} ${templateType}`, async () => {
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

        // // Test data sources
        for (const dataSource of dataSources) {
          test(`data source: ${dataSource} ${templateType}`, async () => {
          const dataSourceType = dataSource.split(" ")[0];
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
          test.describe(`observability: ${observability} ${templateType}`, async () => {
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
      }
    });

    test.describe("LlamaIndexServer", async () => {
      test.skip(templateType !== "llamaindexserver", `skipping llamaindexserver test for ${templateType}`);
      test.skip(dataSource !== "--example-file", `skipping llamaindexserver test for ${dataSource}`);
      for (const useCase of useCases) {
        const cwd = await createTestDir();
        await createAndCheckLlamaProject({
          options: {
            cwd,
            templateType: "llamaindexserver",
            templateFramework,
            dataSource,
            vectorDb: "none",
            tools: "none",
            port: 3000,
            postInstallAction: "none",
            templateUI: undefined,
            appType: "--no-frontend",
            llamaCloudProjectName: undefined,
            llamaCloudIndexName: undefined,
            observability: undefined,
            useCase,
          },
        });
      }
    });

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

      // Modify environment for the command
      const commandEnv = {
        ...process.env,
      };

      console.log("Running uv venv...");
      try {
        const { stdout: venvStdout, stderr: venvStderr } = await execAsync(
          "uv venv",
          { cwd: projectPath, env: commandEnv },
        );
        console.log("uv venv stdout:", venvStdout);
        console.error("uv venv stderr:", venvStderr);
      } catch (error) {
        console.error("Error running uv venv:", error);
        throw error; // Re-throw error to fail the test
      }

      console.log("Running uv sync...");
      try {
        const { stdout: syncStdout, stderr: syncStderr } = await execAsync(
          "uv sync --all-extras",
          { cwd: projectPath, env: commandEnv },
        );
        console.log("uv sync stdout:", syncStdout);
        console.error("uv sync stderr:", syncStderr);
      } catch (error) {
        console.error("Error running uv sync:", error);
        throw error; // Re-throw error to fail the test
      }

      console.log("Running uv run mypy ....");
      try {
        const { stdout: mypyStdout, stderr: mypyStderr } = await execAsync(
          "uv run mypy .",
          { cwd: projectPath, env: commandEnv },
        );
        console.log("uv run mypy stdout:", mypyStdout);
        console.error("uv run mypy stderr:", mypyStderr);
        // Assuming mypy success means no output or specific success message
        // Adjust checks based on actual expected mypy output
      } catch (error) {
        console.error("Error running mypy:", error);
        throw error;
      }

      // If we reach this point without throwing an error, the test passes
      expect(true).toBeTruthy();

    return { pyprojectPath, projectPath };
  }
});