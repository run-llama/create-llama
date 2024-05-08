import fs from "fs/promises";
import path from "path";
import { red } from "picocolors";
import yaml from "yaml";
import { makeDir } from "./make-dir";
import { TemplateFramework } from "./types";

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
  },
  {
    display: "Weather",
    name: "weather",
    dependencies: [],
    supportedFrameworks: ["fastapi", "express", "nextjs"],
    type: ToolType.LOCAL,
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
