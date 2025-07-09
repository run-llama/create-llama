import { expect, test } from "@playwright/test";
import { ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import {
  ALL_NEXTJS_USE_CASES,
  ALL_PYTHON_USE_CASES,
  type TemplateFramework,
  type TemplateVectorDB,
} from "../../helpers";
import { createTestDir, runCreateLlama } from "../utils";

const templateFramework: TemplateFramework = process.env.FRAMEWORK
  ? (process.env.FRAMEWORK as TemplateFramework)
  : "fastapi";
const vectorDb: TemplateVectorDB = process.env.VECTORDB
  ? (process.env.VECTORDB as TemplateVectorDB)
  : "none";
const llamaCloudProjectName = "create-llama";
const llamaCloudIndexName = "e2e-test";
const allUseCases =
  templateFramework === "nextjs" ? ALL_NEXTJS_USE_CASES : ALL_PYTHON_USE_CASES;

const isPythonLlamaDeploy = templateFramework === "fastapi";
const DEPLOYMENT_NAME = "chat";

const userMessage = "Write a blog post about physical standards for letters";

for (const useCase of allUseCases) {
  test.describe(`Test use case ${useCase} ${templateFramework} ${vectorDb}`, async () => {
    let port: number;
    let cwd: string;
    let name: string;
    let appProcess: ChildProcess;
    let frontendUrl: string;
    let submitChatApi: string;

    test.beforeAll(async () => {
      port = Math.floor(Math.random() * 10000) + 10000;
      cwd = await createTestDir();
      const result = await runCreateLlama({
        cwd,
        templateFramework,
        vectorDb,
        port,
        postInstallAction: "runApp",
        useCase,
        llamaCloudProjectName,
        llamaCloudIndexName,
      });
      name = result.projectName;
      appProcess = result.appProcess;
      frontendUrl = isPythonLlamaDeploy
        ? `http://localhost:${port}/deployments/${DEPLOYMENT_NAME}/ui`
        : `http://localhost:${port}`;
      submitChatApi = isPythonLlamaDeploy
        ? `/deployments/${DEPLOYMENT_NAME}/tasks/create`
        : `/api/chat`;
    });

    test("App folder should exist", async () => {
      const dirExists = fs.existsSync(path.join(cwd, name));
      expect(dirExists).toBeTruthy();
    });

    test("Frontend should have a title", async ({ page }) => {
      await page.goto(frontendUrl);
      await expect(page.getByText("Built by LlamaIndex")).toBeVisible({
        timeout: 5 * 60 * 1000,
      });
    });

    test("Frontend should be able to submit a message and receive the start of a streamed response", async ({
      page,
    }) => {
      test.skip(
        useCase === "financial_report" || useCase === "deep_research",
        "Skip chat tests for financial report and deep research.",
      );
      await page.goto(frontendUrl);
      await page.fill("form textarea", userMessage);

      const responsePromise = page.waitForResponse((res) =>
        res.url().includes(submitChatApi),
      );

      await page.click("form button[type=submit]");

      const response = await responsePromise;
      console.log(`Response status: ${response.status()}`);
      const responseBody = await response
        .text()
        .catch((e) => `Error reading body: ${e}`);
      console.log(`Response body: ${responseBody}`);

      expect(response.ok()).toBeTruthy();
    });

    // clean processes
    test.afterAll(async () => {
      appProcess?.kill();
    });
  });
}
