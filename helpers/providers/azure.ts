import ciInfo from "ci-info";
import prompts from "prompts";
import { ModelConfigParams, ModelConfigQuestionsParams } from ".";
import { questionHandlers } from "../../questions/utils";

const ALL_AZURE_OPENAI_CHAT_MODELS: Record<string, { openAIModel: string }> = {
  "gpt-35-turbo": { openAIModel: "gpt-3.5-turbo" },
  "gpt-35-turbo-16k": {
    openAIModel: "gpt-3.5-turbo-16k",
  },
  "gpt-4o": { openAIModel: "gpt-4o" },
  "gpt-4o-mini": { openAIModel: "gpt-4o-mini" },
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
  "gpt-4o-mini-2024-07-18": {
    openAIModel: "gpt-4o-mini-2024-07-18",
  },
};

const ALL_AZURE_OPENAI_EMBEDDING_MODELS: Record<
  string,
  {
    dimensions: number;
    openAIModel: string;
  }
> = {
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
    apiKey: openAiKey || process.env.AZURE_OPENAI_KEY,
    model: DEFAULT_MODEL,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    dimensions: getDimensions(DEFAULT_EMBEDDING_MODEL),
    isConfigured(): boolean {
      // the Azure model provider can't be fully configured as endpoint and deployment names have to be configured with env variables
      return false;
    },
  };

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
