import inquirer from "inquirer";
import { ModelConfig, ModelProvider, TemplateFramework } from "../types";
import { askAnthropicQuestions } from "./anthropic";
import { askAzureQuestions } from "./azure";
import { askGeminiQuestions } from "./gemini";
import { askGroqQuestions } from "./groq";
import { askHuggingfaceQuestions } from "./huggingface";
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
  if (askModels) {
    let choices = [
      { name: "OpenAI", value: "openai" },
      { name: "Groq", value: "groq" },
      { name: "Ollama", value: "ollama" },
      { name: "Anthropic", value: "anthropic" },
      { name: "Gemini", value: "gemini" },
      { name: "Mistral", value: "mistral" },
      { name: "AzureOpenAI", value: "azure-openai" },
    ];

    if (framework === "fastapi") {
      choices.push({ name: "T-Systems", value: "t-systems" });
      choices.push({ name: "Huggingface", value: "huggingface" });
    }
    const { provider } = await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "Which model provider would you like to use",
        choices: choices,
      },
    ]);
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
    case "huggingface":
      modelConfig = await askHuggingfaceQuestions({ askModels });
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
