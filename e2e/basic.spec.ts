/* eslint-disable turbo/no-undeclared-env-vars */
import { expect, test } from "@playwright/test";
import { ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import type {
  TemplateFramework,
  TemplatePostInstallAction,
  TemplateType,
  TemplateUI,
} from "../helpers";
import { createTestDir, runCreateLlama, type AppType } from "./utils";

const templateTypes: TemplateType[] = ["streaming"];
const templateFrameworks: TemplateFramework[] = [
  "nextjs",
  "express",
  "fastapi",
];
const dataSources: string[] = ["--no-files", "--example-file"];
const templateUIs: TemplateUI[] = ["shadcn", "html"];
const templatePostInstallActions: TemplatePostInstallAction[] = [
  "none",
  "runApp",
];

for (const templateType of templateTypes) {
  for (const templateFramework of templateFrameworks) {
    for (const dataSource of dataSources) {
      for (const templateUI of templateUIs) {
        for (const templatePostInstallAction of templatePostInstallActions) {
          const appType: AppType =
            templateFramework === "nextjs" ? "" : "--frontend";
          test.describe(`try create-llama ${templateType} ${templateFramework} ${dataSource} ${templateUI} ${appType} ${templatePostInstallAction}`, async () => {
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
                templateType,
                templateFramework,
                dataSource,
                templateUI,
                vectorDb,
                appType,
                port,
                externalPort,
                templatePostInstallAction,
              );
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
              await page.fill("form input", "hello");
              const [response] = await Promise.all([
                page.waitForResponse(
                  (res) => {
                    return (
                      res.url().includes("/api/chat") && res.status() === 200
                    );
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
                        content: "Hello",
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
        }
      }
    }
  }
}
