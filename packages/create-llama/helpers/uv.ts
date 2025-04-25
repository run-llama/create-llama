// Migrate poetry to uv
import { execSync } from "child_process";
import fs from "fs";
import { red } from "picocolors";

export function isUvAvailable(): boolean {
  try {
    execSync("uv --version", { stdio: "ignore" });
    return true;
  } catch (_) {}
  return false;
}

export function tryUvSync(): boolean {
  try {
    console.log("Syncing environment with pyproject.toml...");
    execSync(`uv sync`, {
      stdio: "inherit",
    });
    return true;
  } catch (_) {}
  return false;
}

export function tryUvRun(command: string): boolean {
  try {
    // Use uv run <command>
    execSync(`uv run ${command}`, { stdio: "inherit" });
    return true;
  } catch (error) {
    console.error(red(`Failed to run ${command}. Error: ${error}`));
    return false;
  }
}

export function isHavingUvLockFile(): boolean {
  try {
    // Check if uv.lock exists in the current directory
    return fs.existsSync("uv.lock");
  } catch (_) {}
  return false;
}
