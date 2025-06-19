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
      templateFramework,
      vectorDb,
      port,
      postInstallAction: "dependencies",
      useCase,
      llamaCloudProjectName,
      llamaCloudIndexName,
    });
    name = result.projectName;
    appProcess = result.appProcess;
  });

  test("Should successfully eject, install dependencies and build without errors", async ({
    page,
  }) => {
    test.skip(
      vectorDb === "llamacloud",
      "Eject test only works with non-llamacloud",
    );
    // Run eject command
    execSync("npm run eject", { cwd: path.join(cwd, name) });

    // Verify next directory exists
    const nextDirExists = fs.existsSync(path.join(cwd, name, ejectDir));
    expect(nextDirExists).toBeTruthy();

    // Install dependencies in next directory
    execSync("npm install", { cwd: path.join(cwd, name, ejectDir) });

    // Run build
    execSync("npm run build", { cwd: path.join(cwd, name, ejectDir) });
  });

  // clean processes
  test.afterAll(async () => {
    appProcess?.kill();
  });
});
