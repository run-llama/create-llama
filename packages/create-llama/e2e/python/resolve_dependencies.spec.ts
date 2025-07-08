import { expect, test } from "@playwright/test";
import { exec } from "child_process";
import fs from "fs";
import path from "path";
import util from "util";
import {
  ALL_PYTHON_USE_CASES,
  TemplateFramework,
  TemplateVectorDB,
} from "../../helpers/types";
import { RunCreateLlamaOptions, createTestDir, runCreateLlama } from "../utils";

const execAsync = util.promisify(exec);

const templateFramework: TemplateFramework = "fastapi";
const vectorDb: TemplateVectorDB = process.env.VECTORDB
  ? (process.env.VECTORDB as TemplateVectorDB)
  : "none";

test.describe("Mypy check", () => {
  test.describe.configure({ retries: 0 });

  test.describe("LlamaIndexServer", async () => {
    for (const useCase of ALL_PYTHON_USE_CASES) {
      test(`should pass mypy for use case: ${useCase}`, async () => {
        const cwd = await createTestDir();
        await createAndCheckLlamaProject({
          options: {
            cwd,
            templateFramework,
            vectorDb,
            port: 3000,
            postInstallAction: "none",
            llamaCloudProjectName: undefined,
            llamaCloudIndexName: undefined,
            useCase,
          },
        });
      });
    }
  });
});

async function createAndCheckLlamaProject({
  options,
}: {
  options: RunCreateLlamaOptions;
}): Promise<{ pyprojectPath: string; projectPath: string }> {
  const result = await runCreateLlama(options);
  const name = result.projectName;
  const projectPath = path.join(options.cwd, name);

  // Check if the app folder exists
  expect(fs.existsSync(projectPath)).toBeTruthy();

  // Check if pyproject.toml exists
  const pyprojectPath = path.join(projectPath, "pyproject.toml");
  expect(fs.existsSync(pyprojectPath)).toBeTruthy();

  // Modify environment for the command
  const commandEnv = {
    ...process.env,
  };

  console.log("Running uv venv...");
  try {
    const { stdout: venvStdout, stderr: venvStderr } = await execAsync(
      "uv venv",
      { cwd: projectPath, env: commandEnv },
    );
    console.log("uv venv stdout:", venvStdout);
    console.error("uv venv stderr:", venvStderr);
  } catch (error) {
    console.error("Error running uv venv:", error);
    throw error; // Re-throw error to fail the test
  }

  console.log("Running uv sync...");
  try {
    const { stdout: syncStdout, stderr: syncStderr } = await execAsync(
      "uv sync --all-extras",
      { cwd: projectPath, env: commandEnv },
    );
    console.log("uv sync stdout:", syncStdout);
    console.error("uv sync stderr:", syncStderr);
  } catch (error) {
    console.error("Error running uv sync:", error);
    throw error; // Re-throw error to fail the test
  }

  console.log("Running uv run mypy ....");
  try {
    const { stdout: mypyStdout, stderr: mypyStderr } = await execAsync(
      "uv run mypy .",
      { cwd: projectPath, env: commandEnv },
    );
    console.log("uv run mypy stdout:", mypyStdout);
    console.error("uv run mypy stderr:", mypyStderr);
    // Assuming mypy success means no output or specific success message
    // Adjust checks based on actual expected mypy output
  } catch (error) {
    console.error("Error running mypy:", error);
    throw error;
  }

  // If we reach this point without throwing an error, the test passes
  expect(true).toBeTruthy();

  return { pyprojectPath, projectPath };
}
