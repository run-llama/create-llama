import fs from "fs/promises";
import path from "path";
import { red } from "picocolors";
import yaml from "yaml";
import { EnvVar } from "./env-variables";
import { makeDir } from "./make-dir";
import { TemplateFramework } from "./types";

export const TOOL_SYSTEM_PROMPT_ENV_VAR = "TOOL_SYSTEM_PROMPT";

export enum ToolType {
  LLAMAHUB = "llamahub",
  LOCAL = "local",
}

export type Tool = {
  display: string;
  name: string;
  config?: Record<string, any>;
  dependencies?: ToolDependencies[];
  supportedFrameworks?: Array<TemplateFramework>;
  type: ToolType;
  envVars?: EnvVar[];
};

export type ToolDependencies = {
  name: string;
  version?: string;
};

export const supportedTools: Tool[] = [
  {
    display: "Google Search (configuration required after installation)",
    name: "google.GoogleSearchToolSpec",
    config: {
      engine:
        "Your search engine id, see https://developers.google.com/custom-search/v1/overview#prerequisites",
      key: "Your search api key",
      num: 2,
    },
    dependencies: [
      {
        name: "llama-index-tools-google",
        version: "0.1.2",
      },
    ],
    supportedFrameworks: ["fastapi"],
    type: ToolType.LLAMAHUB,
    envVars: [
      {
        name: TOOL_SYSTEM_PROMPT_ENV_VAR,
        description: "System prompt for google search tool.",
        value: `You are a Google search agent. You help users to get information from Google search.`,
      },
    ],
  },
  {
    display: "Wikipedia",
    name: "wikipedia.WikipediaToolSpec",
    dependencies: [
      {
        name: "llama-index-tools-wikipedia",
        version: "0.1.2",
      },
    ],
    supportedFrameworks: ["fastapi", "express", "nextjs"],
    type: ToolType.LLAMAHUB,
    envVars: [
      {
        name: TOOL_SYSTEM_PROMPT_ENV_VAR,
        description: "System prompt for wiki tool.",
        value: `You are a Wikipedia agent. You help users to get information from Wikipedia.`,
      },
    ],
  },
  {
    display: "Weather",
    name: "weather",
    dependencies: [],
    supportedFrameworks: ["fastapi", "express", "nextjs"],
    type: ToolType.LOCAL,
    envVars: [
      {
        name: TOOL_SYSTEM_PROMPT_ENV_VAR,
        description: "System prompt for weather tool.",
        value: `You are a weather forecast agent. You help users to get the weather forecast for a given location.`,
      },
    ],
  },
  {
    display: "Code Interpreter",
    name: "interpreter",
    dependencies: [],
    supportedFrameworks: ["express", "nextjs"],
    type: ToolType.LOCAL,
    envVars: [
      {
        name: "E2B_API_KEY",
        description:
          "E2B_API_KEY key is required to run code interpreter tool. Get it here: https://e2b.dev/docs/getting-started/api-key",
      },
      {
        name: TOOL_SYSTEM_PROMPT_ENV_VAR,
        description: "System prompt for code interpreter tool.",
        value: `You are a Python interpreter.
        - You are given tasks to complete and you run python code to solve them.
        - The python code runs in a Jupyter notebook. Every time you call \`interpreter\` tool, the python code is executed in a separate cell. It's okay to make multiple calls to \`interpreter\`.
        - Display visualizations using matplotlib or any other visualization library directly in the notebook. Shouldn't save the visualizations to a file, just return the base64 encoded data.
        - You can install any pip package (if it exists) if you need to but the usual packages for data analysis are already preinstalled.
        - You can run any python code you want in a secure environment.
        - Use absolute url from result to display images or any other media.`,
      },
    ],
  },
];

export const getTool = (toolName: string): Tool | undefined => {
  return supportedTools.find((tool) => tool.name === toolName);
};

export const getTools = (toolsName: string[]): Tool[] => {
  const tools: Tool[] = [];
  for (const toolName of toolsName) {
    const tool = getTool(toolName);
    if (!tool) {
      console.log(
        red(
          `Error: Tool '${toolName}' is not supported. Supported tools are: ${supportedTools
            .map((t) => t.name)
            .join(", ")}`,
        ),
      );
      process.exit(1);
    }
    tools.push(tool);
  }
  return tools;
};

export const toolsRequireConfig = (tools?: Tool[]): boolean => {
  if (tools) {
    return tools?.some((tool) => Object.keys(tool.config || {}).length > 0);
  }
  return false;
};

export enum ConfigFileType {
  YAML = "yaml",
  JSON = "json",
}

export const writeToolsConfig = async (
  root: string,
  tools: Tool[] = [],
  type: ConfigFileType = ConfigFileType.YAML,
) => {
  if (tools.length === 0) return; // no tools selected, no config need
  const configContent: {
    [key in ToolType]: Record<string, any>;
  } = {
    local: {},
    llamahub: {},
  };
  tools.forEach((tool) => {
    if (tool.type === ToolType.LLAMAHUB) {
      configContent.llamahub[tool.name] = tool.config ?? {};
    }
    if (tool.type === ToolType.LOCAL) {
      configContent.local[tool.name] = tool.config ?? {};
    }
  });
  const configPath = path.join(root, "config");
  await makeDir(configPath);
  if (type === ConfigFileType.YAML) {
    await fs.writeFile(
      path.join(configPath, "tools.yaml"),
      yaml.stringify(configContent),
    );
  } else {
    await fs.writeFile(
      path.join(configPath, "tools.json"),
      JSON.stringify(configContent, null, 2),
    );
  }
};
