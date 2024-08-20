import { ChildProcess, SpawnOptions, spawn } from "child_process";
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

export function runReflexApp(
  appPath: string,
  frontendPort?: number,
  backendPort?: number,
) {
  const commandArgs = ["run", "reflex", "run"];
  if (frontendPort) {
    commandArgs.push("--frontend-port", frontendPort.toString());
  }
  if (backendPort) {
    commandArgs.push("--backend-port", backendPort.toString());
  }
  return createProcess("poetry", commandArgs, {
    stdio: "inherit",
    cwd: appPath,
  });
}

export function runFastAPIApp(appPath: string, port: number) {
  const commandArgs = ["run", "uvicorn", "main:app", "--port=" + port];

  return createProcess("poetry", commandArgs, {
    stdio: "inherit",
    cwd: appPath,
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
  externalPort?: number,
): Promise<any> {
  const processes: ChildProcess[] = [];

  // Callback to kill all sub processes if the main process is killed
  process.on("exit", () => {
    console.log("Killing app processes...");
    processes.forEach((p) => p.kill());
  });

  // Default sub app paths
  const backendPath = path.join(appPath, "backend");
  const frontendPath = path.join(appPath, "frontend");

  if (template === "extractor") {
    processes.push(runReflexApp(appPath, port, externalPort));
  }
  if (template === "streaming") {
    if (framework === "fastapi" || framework === "express") {
      const backendRunner = framework === "fastapi" ? runFastAPIApp : runTSApp;
      if (frontend) {
        processes.push(backendRunner(backendPath, externalPort || 8000));
        processes.push(runTSApp(frontendPath, port || 3000));
      } else {
        processes.push(backendRunner(appPath, externalPort || 8000));
      }
    } else if (framework === "nextjs") {
      processes.push(runTSApp(appPath, port || 3000));
    }
  }

  return Promise.all(processes);
}
