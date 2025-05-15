import { expect, test } from "@playwright/test";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import {
  TemplateFramework,
  TemplateType,
  TemplateUseCase,
  TemplateVectorDB,
} from "../../helpers/types";
import { createTestDir, runCreateLlama } from "../utils";

const execAsync = util.promisify(exec);

const templateFramework: TemplateFramework = process.env.FRAMEWORK
  ? (process.env.FRAMEWORK as TemplateFramework)
  : "nextjs";
const templateType: TemplateType = process.env.TEMPLATE_TYPE
  ? (process.env.TEMPLATE_TYPE as TemplateType)
  : "llamaindexserver";
const useCases: TemplateUseCase[] = [
  "agentic_rag",
  "deep_research",
  "financial_report",
  "code_generator",
  "document_generator",
];
const dataSource: string = process.env.DATASOURCE
  ? process.env.DATASOURCE
  : "--example-file";

// vectorDBs combinations to test
const vectorDbs: TemplateVectorDB[] = [
  "mongo",
  "pg",
  "qdrant",
  "pinecone",
  "milvus",
  "astra",
  "chroma",
  "llamacloud",
  "weaviate",
];

test.describe("Test resolve TS dependencies", () => {
  test.describe.configure({ retries: 0 });

  // Test vector DBs without LlamaParse
  for (const vectorDb of vectorDbs) {
    const optionDescription = `templateType: ${templateType}, vectorDb: ${vectorDb}, dataSource: ${dataSource}`;

    test(`Vector DB test - ${optionDescription}`, async () => {
      // skip vectordb test for llamaindexserver
      test.skip(
        templateType === "llamaindexserver",
        "skipping vectorDB test for llamaindexserver",
      );

      await runTest({
        templateType: templateType,
        useLlamaParse: false, // Disable LlamaParse for vectorDB test
        vectorDb: vectorDb,
      });
    });
  }

  // No vectorDB, with LlamaParse and useCase
  // Only need to test use case with example data source
  if (dataSource === "--example-file") {
    for (const useCase of useCases) {
      const optionDescription = `templateType: ${templateType}, useCase: ${useCase}`;
      test.describe(`useCase test - ${optionDescription}`, () => {
        test.skip(
          templateType === "streaming",
          "Skipping use case test for streaming template.",
        );
        test(`no llamaParse - ${optionDescription}`, async () => {
          await runTest({
            templateType: templateType,
            useLlamaParse: false,
            useCase: useCase,
          });
        });
        // Skipping llamacloud for the use case doesn't use index.
        if (useCase !== "code_generator" && useCase !== "document_generator") {
          test(`llamaParse - ${optionDescription}`, async () => {
            await runTest({
              templateType: templateType,
              useLlamaParse: true,
              useCase: useCase,
            });
          });
        }
      });
    }
  }
});

async function runTest(options: {
  templateType: TemplateType;
  useLlamaParse: boolean;
  useCase?: TemplateUseCase;
  vectorDb?: TemplateVectorDB;
}) {
  const cwd = await createTestDir();

  const result = await runCreateLlama({
    cwd: cwd,
    templateType: options.templateType,
    templateFramework: templateFramework,
    dataSource: dataSource,
    vectorDb: options.vectorDb ?? "none",
    port: 3000,
    postInstallAction: "none",
    templateUI: undefined,
    appType: templateFramework === "nextjs" ? "" : "--no-frontend",
    llamaCloudProjectName: undefined,
    llamaCloudIndexName: undefined,
    tools: undefined,
    useLlamaParse: options.useLlamaParse,
    useCase: options.useCase,
  });
  const name = result.projectName;

  // Check if the app folder exists
  const appDir = path.join(cwd, name);
  const dirExists = fs.existsSync(appDir);
  expect(dirExists).toBeTruthy();

  // Install dependencies using pnpm
  try {
    const { stderr: installStderr } = await execAsync(
      "pnpm install --prefer-offline --ignore-workspace",
      {
        cwd: appDir,
      },
    );
  } catch (error) {
    console.error("Error installing dependencies:", error);
    throw error;
  }

  // Run tsc type check and capture the output
  try {
    const { stdout, stderr } = await execAsync(
      "pnpm exec tsc -b --diagnostics",
      {
        cwd: appDir,
      },
    );
    // Check if there's any error output
    expect(stderr).toBeFalsy();

    // Log the stdout for debugging purposes
    console.log("TypeScript type-check output:", stdout);
  } catch (error) {
    console.error("Error running tsc:", error);
    throw error;
  }
}
