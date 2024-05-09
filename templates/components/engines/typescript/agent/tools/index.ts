import { BaseToolWithCall } from "llamaindex";
import { getWeatherInformation } from "./weather";

const functionTools: Record<string, BaseToolWithCall[]> = {
  weather: [getWeatherInformation],
};

export function createLocalTools(
  localConfig: Record<string, unknown>,
): BaseToolWithCall[] {
  const tools: BaseToolWithCall[] = [];

  Object.keys(localConfig).forEach((key) => {
    if (key in functionTools) {
      tools.push(...functionTools[key]);
    }
  });

  return tools;
}
