/* eslint-disable turbo/no-undeclared-env-vars */
import { expect, test } from "@playwright/test";
import { ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import type {
  TemplateFramework,
  TemplatePostInstallAction,
  TemplateUI,
} from "../../helpers";
import { createTestDir, runCreateLlama, type AppType } from "../utils";

const templateFramework: TemplateFramework = process.env.FRAMEWORK
  ? (process.env.FRAMEWORK as TemplateFramework)
  : "fastapi";
const dataSource: string = "--example-file";
const templateUI: TemplateUI = "shadcn";
const templatePostInstallAction: TemplatePostInstallAction = "runApp";
const appType: AppType = "--frontend";
const userMessage = "Write a blog post about physical standards for letters";
const templateUseCases = ["financial_report", "agentic_rag", "deep_research"];

for (const useCase of templateUseCases) {
  test.describe(`Test use case ${useCase} ${templateFramework} ${dataSource} ${templateUI} ${appType} ${templatePostInstallAction}`, async () => {
    test.skip(
      process.env.DATASOURCE === "--no-files",
      "The llamaindexserver template currently only works with files. We also only run on Linux to speed up tests.",
    );
    let port: number;
    let cwd: string;
    let name: string;
    let appProcess: ChildProcess;
    // Only test without using vector db for now
    const vectorDb = "none";

    test.beforeAll(async () => {
      port = Math.floor(Math.random() * 10000) + 10000;
      cwd = await createTestDir();
      const result = await runCreateLlama({
        cwd,
        templateType: "llamaindexserver",
        templateFramework,
        dataSource,
        vectorDb,
        port,
        postInstallAction: templatePostInstallAction,
        templateUI,
        appType,
        useCase,
      });
      name = result.projectName;
      appProcess = result.appProcess;
    });

    test("App folder should exist", async () => {
      const dirExists = fs.existsSync(path.join(cwd, name));
      expect(dirExists).toBeTruthy();
    });

    test("Frontend should have a title", async ({ page }) => {
      test.skip(
        templatePostInstallAction !== "runApp" ||
          templateFramework === "express",
      );
      await page.goto(`http://localhost:${port}`);
      await expect(page.getByText("Built by LlamaIndex")).toBeVisible();
    });

    test("Frontend should be able to submit a message and receive the start of a streamed response", async ({
      page,
    }) => {
      test.skip(
        templatePostInstallAction !== "runApp" ||
          useCase === "financial_report" ||
          useCase === "deep_research" ||
          templateFramework === "express",
        "Skip chat tests for financial report and form filling.",
      );
      await page.goto(`http://localhost:${port}`);
      await page.fill("form textarea", userMessage);

      const responsePromise = page.waitForResponse((res) =>
        res.url().includes("/api/chat"),
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
