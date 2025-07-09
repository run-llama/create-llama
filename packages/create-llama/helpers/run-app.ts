import { SpawnOptions, spawn } from "child_process";
import { TemplateFramework, TemplateType } from "./types";

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

export function runFastAPIApp(
  appPath: string,
  port: number,
  template: TemplateType,
) {
  const commandArgs = ["run", "fastapi", "dev", "--port", `${port}`];
  return createProcess("uv", commandArgs, {
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

// TODO: how to run different port (default is 4501)
async function runPythonLlamaDeployServer(
  appPath: string,
  port: number = 4501,
) {
  // Start the llama_deploy server
  createProcess("uv", ["run", "-m", "llama_deploy.apiserver"], {
    stdio: "inherit",
    cwd: appPath,
    env: { ...process.env, APP_PORT: `${port}` },
  });

  // create the deployment
  setTimeout(() => {
    createProcess("uv", ["run", "llamactl", "deploy", "llama_deploy.yml"], {
      stdio: "inherit",
      cwd: appPath,
      env: { ...process.env, APP_PORT: `${port}` },
    });
  }, 1000);
}

export async function runApp(
  appPath: string,
  template: TemplateType,
  framework: TemplateFramework,
  port?: number,
): Promise<void> {
  try {
    // Start the app
    const defaultPort = framework === "nextjs" ? 3000 : 8000;

    if (template === "llamaindexserver") {
      return runPythonLlamaDeployServer(appPath, port);
    }

    const appRunner = framework === "fastapi" ? runFastAPIApp : runTSApp;
    await appRunner(appPath, port || defaultPort, template);
  } catch (error) {
    console.error("Failed to run app:", error);
    throw error;
  }
}
