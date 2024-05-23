import { BaseToolWithCall } from "llamaindex";
import { ToolsFactory } from "llamaindex/tools/ToolsFactory";
import { InterpreterTool, InterpreterToolParams } from "./interpreter";
import { WeatherTool, WeatherToolParams } from "./weather";

type ToolCreator = (config: unknown) => BaseToolWithCall;

export async function createTools(toolConfig: {
  local: Record<string, unknown>;
  llamahub: any;
}): Promise<BaseToolWithCall[]> {
  // add local tools from the 'tools' folder (if configured)
  const tools = createLocalTools(toolConfig.local);
  // add tools from LlamaIndexTS (if configured)
  tools.push(...(await ToolsFactory.createTools(toolConfig.llamahub)));
  return tools;
}

const toolFactory: Record<string, ToolCreator> = {
  weather: (config: unknown) => {
    return new WeatherTool(config as WeatherToolParams);
  },
  interpreter: (config: unknown) => {
    return new InterpreterTool(config as InterpreterToolParams);
  },
};

function createLocalTools(
  localConfig: Record<string, unknown>,
): BaseToolWithCall[] {
  const tools: BaseToolWithCall[] = [];

  Object.keys(localConfig).forEach((key) => {
    if (key in toolFactory) {
      const toolConfig = localConfig[key];
      const tool = toolFactory[key](toolConfig);
      tools.push(tool);
    }
  });

  return tools;
}
