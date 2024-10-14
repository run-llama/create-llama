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
const dataSource: string = process.env.DATASOURCE
  ? process.env.DATASOURCE
  : "--example-file";
const templateUI: TemplateUI = "shadcn";
const templatePostInstallAction: TemplatePostInstallAction = "runApp";

const llamaCloudProjectName = "create-llama";
const llamaCloudIndexName = "e2e-test";

const appType: AppType = templateFramework === "nextjs" ? "" : "--frontend";
const userMessage =
  dataSource !== "--no-files" ? "Physical standard for letters" : "Hello";

test.describe(`Test streaming template ${templateFramework} ${dataSource} ${templateUI} ${appType} ${templatePostInstallAction}`, async () => {
  const isNode18 = process.version.startsWith("v18");
  const isLlamaCloud = dataSource === "--llamacloud";
  // llamacloud is using File API which is not supported on node 18
  if (isNode18 && isLlamaCloud) {
    test.skip(true, "Skipping tests for Node 18 and LlamaCloud data source");
  }

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
    const result = await runCreateLlama({
      cwd,
      templateType: "streaming",
      templateFramework,
      dataSource,
      vectorDb,
      port,
      externalPort,
      postInstallAction: templatePostInstallAction,
      templateUI,
      appType,
      llamaCloudProjectName,
      llamaCloudIndexName,
    });
    name = result.projectName;
    appProcess = result.appProcess;
  });

  test("App folder should exist", async () => {
    const dirExists = fs.existsSync(path.join(cwd, name));
    expect(dirExists).toBeTruthy();
  });
  test("Frontend should have a title", async ({ page }) => {
    test.skip(templatePostInstallAction !== "runApp");
    await page.goto(`http://localhost:${port}`);
    await expect(page.getByText("Built by LlamaIndex")).toBeVisible();
  });

  test("Frontend should be able to submit a message and receive a response", async ({
    page,
  }) => {
    test.skip(templatePostInstallAction !== "runApp");
    await page.goto(`http://localhost:${port}`);
    await page.fill("form textarea", userMessage);
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

  test("Backend frameworks should response when calling non-streaming chat API", async ({
    request,
  }) => {
    test.skip(templatePostInstallAction !== "runApp");
    test.skip(templateFramework === "nextjs");
    const response = await request.post(
      `http://localhost:${externalPort}/api/chat/request`,
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
