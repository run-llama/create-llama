import ciInfo from "ci-info";
import prompts from "prompts";
import { ModelConfigParams } from ".";
import { questionHandlers, toChoice } from "../../questions";

const MODELS = [
  "claude-3-opus",
  "claude-3-sonnet",
  "claude-3-haiku",
  "claude-2.1",
  "claude-instant-1.2",
];
const DEFAULT_MODEL = MODELS[0];

// TODO: get embedding vector dimensions from the anthropic sdk (currently not supported)
// Use huggingface embedding models for now
enum HuggingFaceEmbeddingModelType {
  XENOVA_ALL_MINILM_L6_V2 = "all-MiniLM-L6-v2",
  XENOVA_ALL_MPNET_BASE_V2 = "all-mpnet-base-v2",
}
type ModelData = {
  dimensions: number;
};
const EMBEDDING_MODELS: Record<HuggingFaceEmbeddingModelType, ModelData> = {
  [HuggingFaceEmbeddingModelType.XENOVA_ALL_MINILM_L6_V2]: {
    dimensions: 384,
  },
  [HuggingFaceEmbeddingModelType.XENOVA_ALL_MPNET_BASE_V2]: {
    dimensions: 768,
  },
};
const DEFAULT_EMBEDDING_MODEL = Object.keys(EMBEDDING_MODELS)[0];
const DEFAULT_DIMENSIONS = Object.values(EMBEDDING_MODELS)[0].dimensions;

type AnthropicQuestionsParams = {
  apiKey?: string;
  askModels: boolean;
};

export async function askAnthropicQuestions({
  askModels,
  apiKey,
}: AnthropicQuestionsParams): Promise<ModelConfigParams> {
  const config: ModelConfigParams = {
    apiKey,
    model: DEFAULT_MODEL,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    dimensions: DEFAULT_DIMENSIONS,
    isConfigured(): boolean {
      if (config.apiKey) {
        return true;
      }
      if (process.env["ANTHROPIC_API_KEY"]) {
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
          "Please provide your Anthropic API key (or leave blank to use ANTHROPIC_API_KEY env variable):",
      },
      questionHandlers,
    );
    config.apiKey = key || process.env.ANTHROPIC_API_KEY;
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
    config.dimensions =
      EMBEDDING_MODELS[
        embeddingModel as HuggingFaceEmbeddingModelType
      ].dimensions;
  }

  return config;
}
