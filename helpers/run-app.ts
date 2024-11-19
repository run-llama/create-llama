import { SpawnOptions, spawn } from "child_process";
import { TemplateFramework } from "./types";

const createProcess = (
  command: string,
  args: string[],
  options: SpawnOptions,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    spawn(command, args, {
      ...options,
      shell: true,
    })
      .on("exit", function (code) {
        if (code !== 0) {
          console.log(`Child process exited with code=${code}`);
          reject(code);
        } else {
          resolve();
        }
      })
      .on("error", function (err) {
        console.log("Error when running child process: ", err);
        reject(err);
      });
  });
};

export function buildFrontend(appPath: string, framework: TemplateFramework) {
  const packageManager = framework === "fastapi" ? "poetry" : "npm";
  return createProcess(packageManager, ["run", "build"], {
    stdio: "inherit",
    cwd: appPath,
  });
}

export function runReflexApp(appPath: string, port: number) {
  const commandArgs = [
    "run",
    "reflex",
    "run",
    "--frontend-port",
    port.toString(),
  ];
  return createProcess("poetry", commandArgs, {
    stdio: "inherit",
    cwd: appPath,
  });
}

export function runFastAPIApp(appPath: string, port: number) {
  return createProcess("poetry", ["run", "dev"], {
    stdio: "inherit",
    cwd: appPath,
    env: { ...process.env, APP_PORT: `${port}` },
  });
}

export function runTSApp(appPath: string, port: number) {
  return createProcess("npm", ["run", "dev"], {
    stdio: "inherit",
    cwd: appPath,
    env: { ...process.env, PORT: `${port}` },
  });
}

export async function runApp(
  appPath: string,
  template: string,
  frontend: boolean,
  framework: TemplateFramework,
  port?: number,
): Promise<void> {
  try {
    // Build frontend if needed
    if (frontend && (template === "streaming" || template === "multiagent")) {
      await buildFrontend(appPath, framework);
    }

    // Start the app
    const defaultPort = framework === "nextjs" ? 3000 : 8000;
    const appRunner =
      template === "extractor"
        ? runReflexApp
        : framework === "fastapi"
          ? runFastAPIApp
          : runTSApp;
    await appRunner(appPath, port || defaultPort);
  } catch (error) {
    console.error("Failed to run app:", error);
    throw error;
  }
}
