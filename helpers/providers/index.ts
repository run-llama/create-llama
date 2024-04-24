import ciInfo from "ci-info";
import prompts from "prompts";
import { questionHandlers } from "../../questions";
import { ModelConfig, ModelProvider } from "../types";
import { askOllamaQuestions } from "./ollama";
import { askOpenAIQuestions, isOpenAIConfigured } from "./openai";

const DEFAULT_MODEL_PROVIDER = "openai";

export type ModelConfigQuestionsParams = {
  openAiKey?: string;
  askModels: boolean;
};

export type ModelConfigParams = Omit<ModelConfig, "provider">;

export async function askModelConfig({
  askModels,
  openAiKey,
}: ModelConfigQuestionsParams): Promise<ModelConfig> {
  let modelProvider: ModelProvider = DEFAULT_MODEL_PROVIDER;
  if (askModels && !ciInfo.isCI) {
    const { provider } = await prompts(
      {
        type: "select",
        name: "provider",
        message: "Which model provider would you like to use",
        choices: [
          {
            title: "OpenAI",
            value: "openai",
          },
          { title: "Ollama", value: "ollama" },
        ],
        initial: 0,
      },
      questionHandlers,
    );
    modelProvider = provider;
  }

  let modelConfig: ModelConfigParams;
  switch (modelProvider) {
    case "ollama":
      modelConfig = await askOllamaQuestions({ askModels });
      break;
    default:
      modelConfig = await askOpenAIQuestions({
        openAiKey,
        askModels,
      });
  }
  return {
    ...modelConfig,
    provider: modelProvider,
  };
}

export function isModelConfigured(modelConfig: ModelConfig): boolean {
  switch (modelConfig.provider) {
    case "openai":
      return isOpenAIConfigured(modelConfig);
    default:
      return true;
  }
}
