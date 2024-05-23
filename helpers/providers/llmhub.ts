import ciInfo from "ci-info";
import prompts from "prompts";
import { ModelConfigParams } from ".";
import { questionHandlers, toChoice } from "../../questions";

const MODELS = ["gemini-1.5-pro-latest", "gemini-pro", "gemini-pro-vision"];
type ModelData = {
  dimensions: number;
};
const EMBEDDING_MODELS: Record<string, ModelData> = {
  "embedding-001": { dimensions: 768 },
  "text-embedding-004": { dimensions: 768 },
};

const DEFAULT_MODEL = MODELS[0];
const DEFAULT_EMBEDDING_MODEL = Object.keys(EMBEDDING_MODELS)[0];
const DEFAULT_DIMENSIONS = Object.values(EMBEDDING_MODELS)[0].dimensions;

type LLMHubQuestionsParams = {
  apiKey?: string;
  askModels: boolean;
};

export async function askLLMHubQuestions({
  askModels,
  apiKey,
}: LLMHubQuestionsParams): Promise<ModelConfigParams> {
  const config: ModelConfigParams = {
    apiKey,
    model: DEFAULT_MODEL,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    dimensions: DEFAULT_DIMENSIONS,
    isConfigured(): boolean {
      if (config.apiKey) {
        return true;
      }
      if (process.env["T_SYSTEMS_LLMHUB_API_KEY"]) {
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
        message:
          "Please provide your T-System's LLM Hub key (or leave blank to use T_SYSTEMS_LLMHUB_API_KEY env variable):",
      },
      questionHandlers,
    );
    config.apiKey = key || process.env.T_SYSTEMS_LLMHUB_API_KEY;
  }

  // use default model values in CI or if user should not be asked
  const useDefaults = ciInfo.isCI || !askModels;
  if (!useDefaults) {
    const { model } = await prompts(
      {
        type: "select",
        name: "model",
        message: "Which LLM model would you like to use?",
        choices: MODELS.map(toChoice),
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
        choices: Object.keys(EMBEDDING_MODELS).map(toChoice),
        initial: 0,
      },
      questionHandlers,
    );
    config.embeddingModel = embeddingModel;
    config.dimensions = EMBEDDING_MODELS[embeddingModel].dimensions;
  }

  return config;
}
