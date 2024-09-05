/* eslint-disable turbo/no-undeclared-env-vars */
import { expect, test } from "@playwright/test";
import { ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import type {
  TemplateFramework,
  TemplatePostInstallAction,
  TemplateUI,
} from "../helpers";
import { createTestDir, runCreateLlama, type AppType } from "./utils";

const templateFramework: TemplateFramework = "fastapi";
const dataSource: string = "--example-file";
const templateUI: TemplateUI = "shadcn";
const templatePostInstallAction: TemplatePostInstallAction = "runApp";
const appType: AppType = "--frontend";
const userMessage = "Write a blog post about physical standards for letters";

test.describe(`Test multiagent template ${templateFramework} ${dataSource} ${templateUI} ${appType} ${templatePostInstallAction}`, async () => {
  test.skip(
    process.platform !== "linux" ||
      process.env.FRAMEWORK !== "fastapi" ||
      process.env.DATASOURCE === "--no-files",
    "The multiagent template currently only works with FastAPI and files. We also only run on Linux to speed up tests.",
  );
  let port: number;
  let externalPort: number;
  let cwd: string;
  let name: string;
  let appProcess: ChildProcess;
  // Only test without using vector db for now
  const vectorDb = "none";

  test.beforeAll(async () => {
    port = Math.floor(Math.random() * 10000) + 10000;
    externalPort = port + 1;
    cwd = await createTestDir();
    const result = await runCreateLlama(
      cwd,
      "multiagent",
      templateFramework,
      dataSource,
      vectorDb,
      port,
      externalPort,
      templatePostInstallAction,
      templateUI,
      appType,
    );
    name = result.projectName;
    appProcess = result.appProcess;
  });

  test("App folder should exist", async () => {
    const dirExists = fs.existsSync(path.join(cwd, name));
    expect(dirExists).toBeTruthy();
  });

  test("Frontend should have a title", async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByText("Built by LlamaIndex")).toBeVisible();
  });

  test("Frontend should be able to submit a message and receive a response", async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}`);
    await page.fill("form input", userMessage);
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) => {
          return res.url().includes("/api/chat") && res.status() === 200;
        },
        {
          timeout: 1000 * 60,
        },
      ),
      page.click("form button[type=submit]"),
    ]);
    const text = await response.text();
    console.log("AI response when submitting message: ", text);
    expect(response.ok()).toBeTruthy();
  });

  test("Backend frameworks should response when calling chat API", async ({
    request,
  }) => {
    const response = await request.post(
      `http://localhost:${externalPort}/api/chat`,
      {
        data: {
          messages: [
            {
              role: "user",
              content: userMessage,
            },
          ],
        },
      },
    );
    const text = await response.text();
    console.log("AI response when calling API: ", text);
    expect(response.ok()).toBeTruthy();
  });

  // clean processes
  test.afterAll(async () => {
    appProcess?.kill();
  });
});
