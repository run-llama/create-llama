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
    display: "Google Search",
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
        version: "^0.2.0",
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
    // For python app, we will use a local DuckDuckGo search tool (instead of DuckDuckGo search tool in LlamaHub)
    // to get the same results as the TS app.
    display: "DuckDuckGo Search",
    name: "duckduckgo",
    dependencies: [
      {
        name: "duckduckgo-search",
        version: "6.1.7",
      },
    ],
    supportedFrameworks: ["fastapi", "nextjs", "express"],
    type: ToolType.LOCAL,
    envVars: [
      {
        name: TOOL_SYSTEM_PROMPT_ENV_VAR,
        description: "System prompt for DuckDuckGo search tool.",
        value: `You are a DuckDuckGo search agent. 
You can use the duckduckgo search tool to get information or images from the web to answer user questions.
For better results, you can specify the region parameter to get results from a specific region but it's optional.`,
      },
    ],
  },
  {
    display: "Wikipedia",
    name: "wikipedia.WikipediaToolSpec",
    dependencies: [
      {
        name: "llama-index-tools-wikipedia",
        version: "^0.2.0",
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
    display: "Document generator",
    name: "document_generator",
    // TODO: add support for Typescript templates
    supportedFrameworks: ["fastapi", "nextjs", "express"],
    dependencies: [
      {
        name: "xhtml2pdf",
        version: "^0.2.16",
      },
      {
        name: "markdown",
        version: "^3.7",
      },
    ],
    type: ToolType.LOCAL,
    envVars: [
      {
        name: TOOL_SYSTEM_PROMPT_ENV_VAR,
        description: "System prompt for document generator tool.",
        value: `If user request for a report or a post, use document generator tool to create a file and reply with the link to the file.`,
      },
    ],
  },
  {
    display: "Code Interpreter",
    name: "interpreter",
    dependencies: [
      {
        name: "e2b_code_interpreter",
        version: "0.0.7",
      },
    ],
    supportedFrameworks: ["fastapi", "express", "nextjs"],
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
        value: `-You are a Python interpreter that can run any python code in a secure environment.
- The python code runs in a Jupyter notebook. Every time you call the 'interpreter' tool, the python code is executed in a separate cell. 
- You are given tasks to complete and you run python code to solve them.
- It's okay to make multiple calls to interpreter tool. If you get an error or the result is not what you expected, you can call the tool again. Don't give up too soon!
- Plot visualizations using matplotlib or any other visualization library directly in the notebook.
- You can install any pip package (if it exists) by running a cell with pip install.`,
      },
    ],
  },
  {
    display: "OpenAPI action",
    name: "openapi_action.OpenAPIActionToolSpec",
    dependencies: [
      {
        name: "llama-index-tools-openapi",
        version: "0.2.0",
      },
      {
        name: "jsonschema",
        version: "^4.22.0",
      },
      {
        name: "llama-index-tools-requests",
        version: "0.2.0",
      },
    ],
    config: {
      openapi_uri: "The URL or file path of the OpenAPI schema",
    },
    supportedFrameworks: ["fastapi", "express", "nextjs"],
    type: ToolType.LOCAL,
    envVars: [
      {
        name: TOOL_SYSTEM_PROMPT_ENV_VAR,
        description: "System prompt for openapi action tool.",
        value:
          "You are an OpenAPI action agent. You help users to make requests to the provided OpenAPI schema.",
      },
    ],
  },
  {
    display: "Image Generator",
    name: "img_gen",
    supportedFrameworks: ["fastapi", "express", "nextjs"],
    type: ToolType.LOCAL,
    envVars: [
      {
        name: "STABILITY_API_KEY",
        description:
          "STABILITY_API_KEY key is required to run image generator. Get it here: https://platform.stability.ai/account/keys",
      },
      {
        name: TOOL_SYSTEM_PROMPT_ENV_VAR,
        description: "System prompt for image generator tool.",
        value: `You are an image generator agent. You help users to generate images using the Stability API.`,
      },
    ],
  },
  {
    display: "Azure Code Interpreter",
    name: "azure_code_interpreter.AzureCodeInterpreterToolSpec",
    supportedFrameworks: ["fastapi", "nextjs", "express"],
    type: ToolType.LLAMAHUB,
    dependencies: [
      {
        name: "llama-index-tools-azure-code-interpreter",
        version: "0.2.0",
      },
    ],
    envVars: [
      {
        name: "AZURE_POOL_MANAGEMENT_ENDPOINT",
        description:
          "Please follow this guideline to create and get the pool management endpoint: https://learn.microsoft.com/azure/container-apps/sessions?tabs=azure-cli",
      },
      {
        name: TOOL_SYSTEM_PROMPT_ENV_VAR,
        description: "System prompt for Azure code interpreter tool.",
        value: `-You are a Python interpreter that can run any python code in a secure environment.
- The python code runs in a Jupyter notebook. Every time you call the 'interpreter' tool, the python code is executed in a separate cell. 
- You are given tasks to complete and you run python code to solve them.
- It's okay to make multiple calls to interpreter tool. If you get an error or the result is not what you expected, you can call the tool again. Don't give up too soon!
- Plot visualizations using matplotlib or any other visualization library directly in the notebook.
- You can install any pip package (if it exists) by running a cell with pip install.`,
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

export const toolRequiresConfig = (tool: Tool): boolean => {
  const hasConfig = Object.keys(tool.config || {}).length > 0;
  const hasEmptyEnvVar = tool.envVars?.some((envVar) => !envVar.value) ?? false;
  return hasConfig || hasEmptyEnvVar;
};

export const toolsRequireConfig = (tools?: Tool[]): boolean => {
  if (tools) {
    return tools?.some(toolRequiresConfig);
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
