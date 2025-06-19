import { expect, test } from "@playwright/test";
import { ChildProcess, execSync } from "child_process";
import fs from "fs";
import path from "path";
import { type TemplateFramework, type TemplateVectorDB } from "../../helpers";
import { createTestDir, runCreateLlama } from "../utils";

const templateFramework: TemplateFramework = "nextjs";
const useCase = "code_generator";
const vectorDb: TemplateVectorDB = process.env.VECTORDB
  ? (process.env.VECTORDB as TemplateVectorDB)
  : "none";

const llamaCloudProjectName = "create-llama";
const llamaCloudIndexName = "e2e-test";

const ejectDir = "next";

test.describe(`Test eject command for ${useCase} ${templateFramework} ${vectorDb}`, async () => {
  let port: number;
  let cwd: string;
  let name: string;
  let appProcess: ChildProcess;

  test.beforeAll(async () => {
    port = Math.floor(Math.random() * 10000) + 10000;
    cwd = await createTestDir();
    const result = await runCreateLlama({
      cwd,
      templateType: "llamaindexserver",
      templateFramework,
      vectorDb,
      port,
      postInstallAction: "runApp",
      useCase,
      llamaCloudProjectName,
      llamaCloudIndexName,
      useLlamaParse: false,
    });
    name = result.projectName;
    appProcess = result.appProcess;
  });

  test("Should successfully eject, install dependencies and build without errors", async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByText("Built by LlamaIndex")).toBeVisible({
      timeout: 5 * 60 * 1000,
    });

    // Run eject command
    execSync("pnpm run eject", { cwd: path.join(cwd, name) });

    // Verify next directory exists
    const nextDirExists = fs.existsSync(path.join(cwd, name, ejectDir));
    expect(nextDirExists).toBeTruthy();

    // Install dependencies in next directory
    execSync("pnpm install", { cwd: path.join(cwd, name, ejectDir) });

    // Run build
    execSync("pnpm run build", { cwd: path.join(cwd, name, ejectDir) });
  });

  // clean processes
  test.afterAll(async () => {
    appProcess?.kill();
  });
});
