import { ChildProcess, exec } from "child_process";
import crypto from "node:crypto";
import { mkdir } from "node:fs/promises";
import * as path from "path";
import waitPort from "wait-port";
import {
  TemplateFramework,
  TemplatePostInstallAction,
  TemplateType,
  TemplateUI,
  TemplateVectorDB,
} from "../helpers";

export type AppType = "--frontend" | "--no-frontend" | "";

export type CreateLlamaResult = {
  projectName: string;
  appProcess: ChildProcess;
};

// eslint-disable-next-line max-params
export async function checkAppHasStarted(
  frontend: boolean,
  framework: TemplateFramework,
  port: number,
  externalPort: number,
  timeout: number,
) {
  if (frontend) {
    await Promise.all([
      waitPort({
        host: "localhost",
        port: port,
        timeout,
      }),
      waitPort({
        host: "localhost",
        port: externalPort,
        timeout,
      }),
    ]).catch((err) => {
      console.error(err);
      throw err;
    });
  } else {
    let wPort: number;
    if (framework === "nextjs") {
      wPort = port;
    } else {
      wPort = externalPort;
    }
    await waitPort({
      host: "localhost",
      port: wPort,
      timeout,
    }).catch((err) => {
      console.error(err);
      throw err;
    });
  }
}

// eslint-disable-next-line max-params
export async function runCreateLlama(
  cwd: string,
  templateType: TemplateType,
  templateFramework: TemplateFramework,
  dataSource: string,
  templateUI: TemplateUI,
  vectorDb: TemplateVectorDB,
  appType: AppType,
  port: number,
  externalPort: number,
  postInstallAction: TemplatePostInstallAction,
): Promise<CreateLlamaResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Setting OPENAI_API_KEY is mandatory to run tests");
  }
  const name = [
    templateType,
    templateFramework,
    dataSource,
    templateUI,
    appType,
  ].join("-");
  const command = [
    "create-llama",
    name,
    "--template",
    templateType,
    "--framework",
    templateFramework,
    dataSource,
    "--ui",
    templateUI,
    "--vector-db",
    vectorDb,
    "--open-ai-key",
    process.env.OPENAI_API_KEY,
    appType,
    "--use-pnpm",
    "--port",
    port,
    "--external-port",
    externalPort,
    "--post-install-action",
    postInstallAction,
    "--tools",
    "none",
    "--no-llama-parse",
    "--observability",
    "none",
  ].join(" ");
  console.log(`running command '${command}' in ${cwd}`);
  const appProcess = exec(command, {
    cwd,
    env: {
      ...process.env,
    },
  });
  appProcess.stderr?.on("data", (data) => {
    console.log(data.toString());
  });
  appProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      throw new Error(`create-llama command was failed!`);
    }
  });

  // Wait for app to start
  if (postInstallAction === "runApp") {
    await checkAppHasStarted(
      appType === "--frontend",
      templateFramework,
      port,
      externalPort,
      1000 * 60 * 5,
    );
  } else {
    // wait create-llama to exit
    // we don't test install dependencies for now, so just set timeout for 10 seconds
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("create-llama timeout error"));
      }, 1000 * 10);
      appProcess.on("exit", (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error("create-llama command was failed!"));
        } else {
          clearTimeout(timeout);
          resolve(undefined);
        }
      });
    });
  }

  return {
    projectName: name,
    appProcess,
  };
}

export async function createTestDir() {
  const cwd = path.join(__dirname, "cache", crypto.randomUUID());
  await mkdir(cwd, { recursive: true });
  return cwd;
}
