import { expect, test } from "@playwright/test";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import { TemplateFramework, TemplateVectorDB } from "../helpers/types";
import { createTestDir, runCreateLlama } from "./utils";

const execAsync = util.promisify(exec);

const templateFramework: TemplateFramework = process.env.FRAMEWORK
  ? (process.env.FRAMEWORK as TemplateFramework)
  : "nextjs";
const dataSource: string = process.env.DATASOURCE
  ? process.env.DATASOURCE
  : "--example-file";

if (
  templateFramework == "nextjs" ||
  templateFramework == "express" // test is only relevant for TS projects
) {
  // vectorDBs combinations to test
  const vectorDbs: TemplateVectorDB[] = [
    "mongo",
    "pg",
    "pinecone",
    "milvus",
    "astra",
    "qdrant",
    "chroma",
    "llamacloud",
    "weaviate",
  ];

  test.describe("Test resolve TS dependencies", () => {
    for (const vectorDb of vectorDbs) {
      const optionDescription = `vectorDb: ${vectorDb}, dataSource: ${dataSource}`;

      test(`options: ${optionDescription}`, async () => {
        const cwd = await createTestDir();

        const result = await runCreateLlama(
          cwd,
          "streaming",
          templateFramework,
          dataSource,
          vectorDb,
          3000, // port
          8000, // externalPort
          "dependencies", // postInstallAction
        );
        const name = result.projectName;

        // Check if the app folder exists
        const appDir = path.join(cwd, name);
        const dirExists = fs.existsSync(appDir);
        expect(dirExists).toBeTruthy();

        // Run tsc -b --diagnostics and capture the output
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
      });
    }
  });
}
