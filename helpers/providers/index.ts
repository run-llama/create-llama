import ciInfo from "ci-info";
import prompts from "prompts";
import { questionHandlers } from "../../questions";
import { ModelConfig, ModelProvider, TemplateFramework } from "../types";
import { askAnthropicQuestions } from "./anthropic";
import { askAzureQuestions } from "./azure";
import { askGeminiQuestions } from "./gemini";
import { askGroqQuestions } from "./groq";
import { askLLMHubQuestions } from "./llmhub";
import { askMistralQuestions } from "./mistral";
import { askOllamaQuestions } from "./ollama";
import { askOpenAIQuestions } from "./openai";

const DEFAULT_MODEL_PROVIDER = "openai";

export type ModelConfigQuestionsParams = {
  openAiKey?: string;
  askModels: boolean;
  framework?: TemplateFramework;
};

export type ModelConfigParams = Omit<ModelConfig, "provider">;

export async function askModelConfig({
  askModels,
  openAiKey,
  framework,
}: ModelConfigQuestionsParams): Promise<ModelConfig> {
  let modelProvider: ModelProvider = DEFAULT_MODEL_PROVIDER;
  if (askModels && !ciInfo.isCI) {
    let choices = [
      { title: "OpenAI", value: "openai" },
      { title: "Groq", value: "groq" },
      { title: "Ollama", value: "ollama" },
      { title: "Anthropic", value: "anthropic" },
      { title: "Gemini", value: "gemini" },
      { title: "Mistral", value: "mistral" },
      { title: "AzureOpenAI", value: "azure" },
    ];

    if (framework === "fastapi") {
      choices.push({ title: "T-Systems", value: "t-systems" });
    }
    const { provider } = await prompts(
      {
        type: "select",
        name: "provider",
        message: "Which model provider would you like to use",
        choices: choices,
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
    case "mistral":
      modelConfig = await askMistralQuestions({ askModels });
      break;
    case "azure-openai":
      modelConfig = await askAzureQuestions({ askModels });
      break;
    case "t-systems":
      modelConfig = await askLLMHubQuestions({ askModels });
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
