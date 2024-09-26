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

export type RunCreateLlamaOptions = {
  cwd: string;
  templateType: TemplateType;
  templateFramework: TemplateFramework;
  dataSource: string;
  vectorDb: TemplateVectorDB;
  port: number;
  externalPort: number;
  postInstallAction: TemplatePostInstallAction;
  templateUI?: TemplateUI;
  appType?: AppType;
  llamaCloudProjectName?: string;
  llamaCloudIndexName?: string;
  tools?: string;
  useLlamaParse?: boolean;
};

export async function runCreateLlama({
  cwd,
  templateType,
  templateFramework,
  dataSource,
  vectorDb,
  port,
  externalPort,
  postInstallAction,
  templateUI,
  appType,
  llamaCloudProjectName,
  llamaCloudIndexName,
  tools,
  useLlamaParse,
}: RunCreateLlamaOptions): Promise<CreateLlamaResult> {
  if (!process.env.OPENAI_API_KEY || !process.env.LLAMA_CLOUD_API_KEY) {
    throw new Error(
      "Setting the OPENAI_API_KEY and LLAMA_CLOUD_API_KEY is mandatory to run tests",
    );
  }
  const name = [
    templateType,
    templateFramework,
    dataSource.split(" ")[0],
    templateUI,
    appType,
  ].join("-");

  // Handle different data source types
  let dataSourceArgs = [];
  if (dataSource.includes("--web-source" || "--db-source")) {
    const webSource = dataSource.split(" ")[1];
    dataSourceArgs.push("--web-source", webSource);
  } else if (dataSource.includes("--db-source")) {
    const dbSource = dataSource.split(" ")[1];
    dataSourceArgs.push("--db-source", dbSource);
  } else {
    dataSourceArgs.push(dataSource);
  }

  const commandArgs = [
    "create-llama",
    name,
    "--template",
    templateType,
    "--framework",
    templateFramework,
    ...dataSourceArgs,
    "--vector-db",
    vectorDb,
    "--open-ai-key",
    process.env.OPENAI_API_KEY,
    "--use-pnpm",
    "--port",
    port,
    "--external-port",
    externalPort,
    "--post-install-action",
    postInstallAction,
    "--tools",
    tools ?? "none",
    "--observability",
    "none",
    "--llama-cloud-key",
    process.env.LLAMA_CLOUD_API_KEY,
  ];

  if (templateUI) {
    commandArgs.push("--ui", templateUI);
  }
  if (appType) {
    commandArgs.push(appType);
  }
  if (!useLlamaParse) {
    commandArgs.push("--no-llama-parse");
  }

  const command = commandArgs.join(" ");
  console.log(`running command '${command}' in ${cwd}`);
  const appProcess = exec(command, {
    cwd,
    env: {
      ...process.env,
      LLAMA_CLOUD_PROJECT_NAME: llamaCloudProjectName,
      LLAMA_CLOUD_INDEX_NAME: llamaCloudIndexName,
    },
  });
  appProcess.stderr?.on("data", (data) => {
    console.error(data.toString());
  });
  appProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      throw new Error(`create-llama command failed with exit code ${code}`);
    }
  });

  // Wait for app to start
  if (postInstallAction === "runApp") {
    await checkAppHasStarted(
      appType === "--frontend",
      templateFramework,
      port,
      externalPort,
    );
  } else if (postInstallAction === "dependencies") {
    await waitForProcess(appProcess, 1000 * 60); // wait 1 min for dependencies to be resolved
  } else {
    // wait 10 seconds for create-llama to exit
    await waitForProcess(appProcess, 1000 * 10);
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

// eslint-disable-next-line max-params
async function checkAppHasStarted(
  frontend: boolean,
  framework: TemplateFramework,
  port: number,
  externalPort: number,
) {
  const portsToWait = frontend
    ? [port, externalPort]
    : [framework === "nextjs" ? port : externalPort];
  await waitPorts(portsToWait);
}

async function waitPorts(ports: number[]): Promise<void> {
  const waitForPort = async (port: number): Promise<void> => {
    await waitPort({
      host: "localhost",
      port: port,
      // wait max. 5 mins for start up of app
      timeout: 1000 * 60 * 5,
    });
  };
  try {
    await Promise.all(ports.map(waitForPort));
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function waitForProcess(
  process: ChildProcess,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Process timeout error"));
    }, timeoutMs);

    process.on("exit", (code) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        reject(new Error("Process exited with non-zero code"));
      } else {
        resolve();
      }
    });
  });
}
