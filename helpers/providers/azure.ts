import ciInfo from "ci-info";
import prompts from "prompts";
import { ModelConfigParams, ModelConfigQuestionsParams } from ".";
import { questionHandlers } from "../../questions";

const ALL_AZURE_OPENAI_CHAT_MODELS: Record<string, { openAIModel: string }> = {
  "gpt-35-turbo": { openAIModel: "gpt-3.5-turbo" },
  "gpt-35-turbo-16k": {
    openAIModel: "gpt-3.5-turbo-16k",
  },
  "gpt-4o": { openAIModel: "gpt-4o" },
  "gpt-4": { openAIModel: "gpt-4" },
  "gpt-4-32k": { openAIModel: "gpt-4-32k" },
  "gpt-4-turbo": {
    openAIModel: "gpt-4-turbo",
  },
  "gpt-4-turbo-2024-04-09": {
    openAIModel: "gpt-4-turbo",
  },
  "gpt-4-vision-preview": {
    openAIModel: "gpt-4-vision-preview",
  },
  "gpt-4-1106-preview": {
    openAIModel: "gpt-4-1106-preview",
  },
  "gpt-4o-2024-05-13": {
    openAIModel: "gpt-4o-2024-05-13",
  },
};

const ALL_AZURE_OPENAI_EMBEDDING_MODELS: Record<
  string,
  {
    dimensions: number;
    openAIModel: string;
  }
> = {
  "text-embedding-ada-002": {
    dimensions: 1536,
    openAIModel: "text-embedding-ada-002",
  },
  "text-embedding-3-small": {
    dimensions: 1536,
    openAIModel: "text-embedding-3-small",
  },
  "text-embedding-3-large": {
    dimensions: 3072,
    openAIModel: "text-embedding-3-large",
  },
};

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large";

export async function askAzureQuestions({
  openAiKey,
  askModels,
}: ModelConfigQuestionsParams): Promise<ModelConfigParams> {
  const config: ModelConfigParams = {
    apiKey: openAiKey,
    model: DEFAULT_MODEL,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    dimensions: getDimensions(DEFAULT_EMBEDDING_MODEL),
    isConfigured(): boolean {
      if (config.apiKey) {
        return true;
      }
      if (process.env["AZURE_OPENAI_KEY"]) {
        return true;
      }
      return false;
    },
  };

  if (!config.apiKey) {
    const { key } = await prompts(
      {
        type: "text",
        name: "key",
        message: askModels
          ? "Please provide your Azure OpenAI API key (or leave blank to use AZURE_OPENAI_KEY env variable):"
          : "Please provide your Azure OpenAI API key (leave blank to skip):",
        validate: (value: string) => {
          if (askModels && !value) {
            if (process.env.AZURE_OPENAI_KEY) {
              return true;
            }
            return "AZURE_OPENAI_KEY env variable is not set - key is required";
          }
          return true;
        },
      },
      questionHandlers,
    );
    config.apiKey = key || process.env.AZURE_OPENAI_KEY;
  }

  // use default model values in CI or if user should not be asked
  const useDefaults = ciInfo.isCI || !askModels;
  if (!useDefaults) {
    const { model } = await prompts(
      {
        type: "select",
        name: "model",
        message: "Which LLM model would you like to use?",
        choices: getAvailableModelChoices(),
        initial: 0,
      },
      questionHandlers,
    );
    config.model = model;

    const { embeddingModel } = await prompts(
      {
        type: "select",
        name: "embeddingModel",
        message: "Which embedding model would you like to use?",
        choices: getAvailableEmbeddingModelChoices(),
        initial: 0,
      },
      questionHandlers,
    );
    config.embeddingModel = embeddingModel;
    config.dimensions = getDimensions(embeddingModel);
  }

  return config;
}

function getAvailableModelChoices() {
  return Object.keys(ALL_AZURE_OPENAI_CHAT_MODELS).map((key) => ({
    title: key,
    value: key,
  }));
}

function getAvailableEmbeddingModelChoices() {
  return Object.keys(ALL_AZURE_OPENAI_EMBEDDING_MODELS).map((key) => ({
    title: key,
    value: key,
  }));
}

function getDimensions(modelName: string) {
  return ALL_AZURE_OPENAI_EMBEDDING_MODELS[modelName].dimensions;
}
