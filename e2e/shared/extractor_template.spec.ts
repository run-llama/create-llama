/* eslint-disable turbo/no-undeclared-env-vars */
import { expect, test } from "@playwright/test";
import { ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { TemplateFramework } from "../../helpers";
import { createTestDir, runCreateLlama } from "../utils";

const templateFramework: TemplateFramework = process.env.FRAMEWORK
  ? (process.env.FRAMEWORK as TemplateFramework)
  : "fastapi";
const dataSource: string = process.env.DATASOURCE
  ? process.env.DATASOURCE
  : "--example-file";

// The extractor template currently only works with FastAPI and files (and not on Windows)
if (
  process.platform !== "win32" &&
  templateFramework === "fastapi" &&
  dataSource === "--example-file"
) {
  test.describe("Test extractor template", async () => {
    let frontendPort: number;
    let backendPort: number;
    let name: string;
    let appProcess: ChildProcess;
    let cwd: string;

    // Create extractor app
    test.beforeAll(async () => {
      cwd = await createTestDir();
      frontendPort = Math.floor(Math.random() * 10000) + 10000;
      backendPort = frontendPort + 1;
      const result = await runCreateLlama({
        cwd,
        templateType: "extractor",
        templateFramework: "fastapi",
        dataSource: "--example-file",
        vectorDb: "none",
        port: frontendPort,
        externalPort: backendPort,
        postInstallAction: "runApp",
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
      await page.goto(`http://localhost:${frontendPort}`);
      await expect(page.getByText("Built by LlamaIndex")).toBeVisible({
        timeout: 2000 * 60,
      });
    });
  });
}
