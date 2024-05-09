import { BaseToolWithCall } from "llamaindex";
import { WeatherTool, WeatherToolParams } from "./weather";

type ToolCreator = (config: unknown) => BaseToolWithCall;

const toolFactory: Record<string, ToolCreator> = {
  weather: (config: unknown) => {
    return new WeatherTool(config as WeatherToolParams);
  },
};

export function createLocalTools(
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
