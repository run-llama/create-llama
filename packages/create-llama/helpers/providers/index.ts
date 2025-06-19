import prompts from "prompts";
import { questionHandlers } from "../../questions/utils";
import { ModelConfig, TemplateFramework } from "../types";
import { askAnthropicQuestions } from "./anthropic";
import { askAzureQuestions } from "./azure";
import { askGeminiQuestions } from "./gemini";
import { askGroqQuestions } from "./groq";
import { askHuggingfaceQuestions } from "./huggingface";
import { askLLMHubQuestions } from "./llmhub";
import { askMistralQuestions } from "./mistral";
import { askOllamaQuestions } from "./ollama";
import { askOpenAIQuestions } from "./openai";

export type ModelConfigQuestionsParams = {
  framework?: TemplateFramework;
};

export type ModelConfigParams = Omit<ModelConfig, "provider">;

export async function askModelConfig({
  framework,
}: ModelConfigQuestionsParams): Promise<ModelConfig> {
  const choices = [
    { title: "OpenAI", value: "openai" },
    { title: "Groq", value: "groq" },
    { title: "Ollama", value: "ollama" },
    { title: "Anthropic", value: "anthropic" },
    { title: "Gemini", value: "gemini" },
    { title: "Mistral", value: "mistral" },
    { title: "AzureOpenAI", value: "azure-openai" },
  ];

  if (framework === "fastapi") {
    choices.push({ title: "T-Systems", value: "t-systems" });
    choices.push({ title: "Huggingface", value: "huggingface" });
  }
  const { provider: modelProvider } = await prompts(
    {
      type: "select",
      name: "provider",
      message: "Which model provider would you like to use",
      choices: choices,
      initial: 0,
    },
    questionHandlers,
  );

  let modelConfig: ModelConfigParams;
  switch (modelProvider) {
    case "ollama":
      modelConfig = await askOllamaQuestions();
      break;
    case "groq":
      modelConfig = await askGroqQuestions();
      break;
    case "anthropic":
      modelConfig = await askAnthropicQuestions();
      break;
    case "gemini":
      modelConfig = await askGeminiQuestions();
      break;
    case "mistral":
      modelConfig = await askMistralQuestions();
      break;
    case "azure-openai":
      modelConfig = await askAzureQuestions();
      break;
    case "t-systems":
      modelConfig = await askLLMHubQuestions();
      break;
    case "huggingface":
      modelConfig = await askHuggingfaceQuestions();
      break;
    default:
      modelConfig = await askOpenAIQuestions();
  }
  return {
    ...modelConfig,
    provider: modelProvider,
  };
}
