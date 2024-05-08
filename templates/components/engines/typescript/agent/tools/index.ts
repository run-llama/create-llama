import { BaseToolWithCall } from "llamaindex";
import { tools as weatherTools } from "./weather";

const functionTools: Record<string, BaseToolWithCall[]> = {
  weather: weatherTools,
};

export function getFunctionTools(
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
