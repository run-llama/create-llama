/* eslint-disable turbo/no-undeclared-env-vars */
import { expect, test } from "@playwright/test";
import { ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { TemplateAgents, TemplateFramework } from "../../helpers";
import { createTestDir, runCreateLlama } from "../utils";

const templateFramework: TemplateFramework = process.env.FRAMEWORK
  ? (process.env.FRAMEWORK as TemplateFramework)
  : "fastapi";
const dataSource: string = process.env.DATASOURCE
  ? process.env.DATASOURCE
  : "--example-file";
const templateAgents: TemplateAgents[] = ["extractor", "contract_review"];

// The reflex template currently only works with FastAPI and files (and not on Windows)
if (
  process.platform !== "win32" &&
  templateFramework === "fastapi" &&
  dataSource === "--example-file"
) {
  for (const agents of templateAgents) {
    test.describe(`Test reflex template ${agents} ${templateFramework} ${dataSource}`, async () => {
      let appPort: number;
      let name: string;
      let appProcess: ChildProcess;
      let cwd: string;

      // Create reflex app
      test.beforeAll(async () => {
        cwd = await createTestDir();
        appPort = Math.floor(Math.random() * 10000) + 10000;
        const result = await runCreateLlama({
          cwd,
          templateType: "reflex",
          templateFramework: "fastapi",
          dataSource: "--example-file",
          vectorDb: "none",
          port: appPort,
          postInstallAction: "runApp",
          agents,
        });
        name = result.projectName;
        appProcess = result.appProcess;
      });

      test.afterAll(async () => {
        appProcess.kill();
      });

      test("App folder should exist", async () => {
        const dirExists = fs.existsSync(path.join(cwd, name));
        expect(dirExists).toBeTruthy();
      });
      test("Frontend should have a title", async ({ page }) => {
        await page.goto(`http://localhost:${appPort}`);
        await expect(page.getByText("Built by LlamaIndex")).toBeVisible({
          timeout: 2000 * 60,
        });
      });
    });
  }
}
