import { SpawnOptions, spawn } from "child_process";
import path from "path";
import { TemplateFramework } from "./types";

const createProcess = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => {
  return spawn(command, args, {
    ...options,
    shell: true,
  })
    .on("exit", function (code) {
      if (code !== 0) {
        console.log(`Child process exited with code=${code}`);
        process.exit(1);
      }
    })
    .on("error", function (err) {
      console.log("Error when running chill process: ", err);
      process.exit(1);
    });
};

export async function runExtractorApp(
  appPath: string,
  frontendPort?: number,
  backendPort?: number,
): Promise<any> {
  const commandArgs = ["run", "reflex", "run"];
  if (frontendPort) {
    commandArgs.push("--frontend-port", frontendPort.toString());
  }
  if (backendPort) {
    commandArgs.push("--backend-port", backendPort.toString());
  }
  return new Promise((resolve, reject) => {
    createProcess("poetry", commandArgs, {
      stdio: "inherit",
      cwd: path.join(appPath),
    });
  });
}

export async function runNextApp(
  appPath: string,
  port: number,
  fullstack = false,
) {
  const cwd = fullstack ? path.join(appPath) : path.join(appPath, "frontend");
  return new Promise((resolve, reject) => {
    createProcess("npm", ["run", "dev"], {
      stdio: "inherit",
      cwd,
      env: { ...process.env, PORT: `${port}` },
    });
  });
}

export async function runFastAPIApp(appPath: string, port: number) {
  const commandArgs = ["run", "uvicorn", "main:app", "--port=" + port];

  return new Promise((resolve, reject) => {
    createProcess("poetry", commandArgs, {
      stdio: "inherit",
      cwd: path.join(appPath, "backend"),
    });
  });
}

export async function runExpressApp(appPath: string, port: number) {
  return new Promise((resolve, reject) => {
    createProcess("npm", ["run", "dev"], {
      stdio: "inherit",
      cwd: path.join(appPath, "backend"),
    });
  });
}

export async function runApp(
  appPath: string,
  template: string,
  frontend: boolean,
  framework: TemplateFramework,
  port?: number,
  externalPort?: number,
): Promise<any> {
  if (template === "extractor") {
    return runExtractorApp(appPath, port, externalPort);
  }
  if (template === "streaming") {
    // FastAPI
    if (framework === "fastapi") {
      const process = [];
      process.push(runFastAPIApp(appPath, port || 8000));
      if (frontend) {
        process.push(runNextApp(appPath, port || 3000, true));
      }
      return Promise.all(process);
    }
    // Express
    if (framework === "express") {
      const process = [];
      process.push(runExpressApp(appPath, port || 8000));
      if (frontend) {
        process.push(runNextApp(appPath, port || 3000, true));
      }
      return Promise.all(process);
    }
    // NextJs
    if (framework === "nextjs") {
      return runNextApp(appPath, port || 3000);
    }
  }
}
