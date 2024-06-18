import ciInfo from "ci-info";
import prompts from "prompts";
import { questionHandlers } from "../../questions";
import { ModelConfig, ModelProvider } from "../types";
import { askAnthropicQuestions } from "./anthropic";
import { askGroqQuestions } from "./groq";
import { askGeminiQuestions } from "./gemini";
import { askOllamaQuestions } from "./ollama";
import { askOpenAIQuestions } from "./openai";

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
          { title: "Groq", value: "groq" },
          { title: "Ollama", value: "ollama" },
          { title: "Anthropic", value: "anthropic" },
          { title: "Gemini", value: "gemini" },
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
    case "groq":
      modelConfig = await askGroqQuestions({ askModels });
      break;
    case "anthropic":
      modelConfig = await askAnthropicQuestions({ askModels });
      break;
    case "gemini":
      modelConfig = await askGeminiQuestions({ askModels });
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
