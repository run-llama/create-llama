import { BaseToolWithCall } from "llamaindex";
import { ToolsFactory } from "llamaindex/tools/ToolsFactory";
import { DuckDuckGoSearchTool, DuckDuckGoToolParams } from "./duckduckgo";
import { ImgGeneratorTool, ImgGeneratorToolParams } from "./img-gen";
import { InterpreterTool, InterpreterToolParams } from "./interpreter";
import { OpenAPIActionTool } from "./openapi-action";
import { WeatherTool, WeatherToolParams } from "./weather";

type ToolCreator = (config: unknown) => Promise<BaseToolWithCall[]>;

export async function createTools(toolConfig: {
  local: Record<string, unknown>;
  llamahub: any;
}): Promise<BaseToolWithCall[]> {
  // add local tools from the 'tools' folder (if configured)
  const tools = await createLocalTools(toolConfig.local);
  // add tools from LlamaIndexTS (if configured)
  tools.push(...(await ToolsFactory.createTools(toolConfig.llamahub)));
  return tools;
}

const toolFactory: Record<string, ToolCreator> = {
  weather: async (config: unknown) => {
    return [new WeatherTool(config as WeatherToolParams)];
  },
  interpreter: async (config: unknown) => {
    return [new InterpreterTool(config as InterpreterToolParams)];
  },
  "openapi_action.OpenAPIActionToolSpec": async (config: unknown) => {
    const { openapi_uri, domain_headers } = config as {
      openapi_uri: string;
      domain_headers: Record<string, Record<string, string>>;
    };
    const openAPIActionTool = new OpenAPIActionTool(
      openapi_uri,
      domain_headers,
    );
    return await openAPIActionTool.toToolFunctions();
  },
  duckduckgo: async (config: unknown) => {
    return [new DuckDuckGoSearchTool(config as DuckDuckGoToolParams)];
  },
  img_gen: async (config: unknown) => {
    return [new ImgGeneratorTool(config as ImgGeneratorToolParams)];
  },
};

async function createLocalTools(
  localConfig: Record<string, unknown>,
): Promise<BaseToolWithCall[]> {
  const tools: BaseToolWithCall[] = [];

  for (const [key, toolConfig] of Object.entries(localConfig)) {
    if (key in toolFactory) {
      const newTools = await toolFactory[key](toolConfig);
      tools.push(...newTools);
    }
  }

  return tools;
}
