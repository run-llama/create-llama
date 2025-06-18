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
const vectorDb: TemplateVectorDB = process.env.VECTORDB
  ? (process.env.VECTORDB as TemplateVectorDB)
  : "none";

const useCases: TemplateUseCase[] = [
  "agentic_rag",
  "deep_research",
  "financial_report",
  "code_generator",
  "document_generator",
  "hitl",
];

test.describe("Test resolve TS dependencies", () => {
  test.describe.configure({ retries: 0 });

  for (const useCase of useCases) {
    const optionDescription = `templateType: ${templateType}, useCase: ${useCase}, vectorDb: ${vectorDb}, llamaParse: ${vectorDb === "llamacloud"}`;
    test.describe(`${optionDescription}`, () => {
      test(`${optionDescription}`, async () => {
        await runTest({
          templateType: templateType,
          useLlamaParse: vectorDb === "llamacloud",
          useCase: useCase,
          vectorDb: vectorDb,
        });
      });
    });
  }
});

async function runTest(options: {
  templateType: TemplateType;
  useLlamaParse: boolean;
  useCase: TemplateUseCase;
  vectorDb: TemplateVectorDB;
}) {
  const cwd = await createTestDir();

  const result = await runCreateLlama({
    cwd: cwd,
    templateType: options.templateType,
    templateFramework: templateFramework,
    vectorDb: options.vectorDb,
    port: 3000,
    postInstallAction: "none",
    llamaCloudProjectName: undefined,
    llamaCloudIndexName: undefined,
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
