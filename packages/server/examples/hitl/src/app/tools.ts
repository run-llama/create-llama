import { execSync } from "child_process";
import { tool } from "llamaindex";
import { z } from "zod";

export const cliExecutor = tool({
  name: "cli_executor",
  description: "This tool executes a command and returns the output.",
  parameters: z.object({ command: z.string() }),
  execute: async ({ command }) => {
    try {
      const output = execSync(command, {
        encoding: "utf-8",
      });
      return output;
    } catch (error) {
      console.error(error);
      return "Command failed";
    }
  },
});
