import { SpawnOptions, exec, spawn } from "child_process";
import waitPort from "wait-port";
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

async function runPythonLlamaDeployServer(
  appPath: string,
  port: number = 4501,
) {
  console.log("Starting llama_deploy server...", port);
  const serverProcess = exec("uv run -m llama_deploy.apiserver", {
    cwd: appPath,
    env: {
      ...process.env,
      LLAMA_DEPLOY_APISERVER_PORT: `${port}`,
    },
  });

  // Pipe output to console
  serverProcess.stdout?.pipe(process.stdout);
  serverProcess.stderr?.pipe(process.stderr);

  // Wait for the server to be ready
  console.log("Waiting for server to be ready...");
  await waitPort({ port, host: "localhost", timeout: 30000 });

  // create the deployment with explicit host configuration
  console.log("llama_deploy server started, creating deployment...", port);
  await createProcess(
    "uv",
    [
      "run",
      "llamactl",
      "-s",
      `http://localhost:${port}`,
      "deploy",
      "llama_deploy.yml",
    ],
    {
      stdio: "inherit",
      cwd: appPath,
      shell: true,
    },
  );
  console.log(`Deployment created successfully!`);

  // Keep the main process alive and handle cleanup
  return new Promise(() => {
    process.on("SIGINT", () => {
      console.log("\nShutting down...");
      serverProcess.kill();
      process.exit(0);
    });
  });
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
      await runPythonLlamaDeployServer(appPath, port);
      return;
    }

    const appRunner = framework === "fastapi" ? runFastAPIApp : runTSApp;
    await appRunner(appPath, port || defaultPort, template);
  } catch (error) {
    console.error("Failed to run app:", error);
    throw error;
  }
}
