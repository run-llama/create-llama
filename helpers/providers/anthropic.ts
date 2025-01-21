import inquirer from "inquirer";
import { ModelConfigParams } from ".";
import { toChoice } from "../../questions/utils";

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

  if (!config.apiKey && !process.env.CI) {
    const { key } = await inquirer.prompt([
      {
        type: "input",
        name: "key",
        message: askModels
          ? "Please provide your Anthropic API key (or leave blank to use ANTHROPIC_API_KEY env variable):"
          : "Please provide your Anthropic API key (leave blank to skip):",
        validate: (value: string) => {
          if (askModels && !value) {
            if (process.env.ANTHROPIC_API_KEY) {
              return true;
            }
            return "ANTHROPIC_API_KEY env variable is not set - key is required";
          }
          return true;
        },
      },
    ]);
    config.apiKey = key || process.env.ANTHROPIC_API_KEY;
  }

  if (askModels) {
    const { model } = await inquirer.prompt([
      {
        type: "list",
        name: "model",
        message: "Which LLM model would you like to use?",
        choices: MODELS.map(toChoice),
      },
    ]);
    config.model = model;

    const { embeddingModel } = await inquirer.prompt([
      {
        type: "list",
        name: "embeddingModel",
        message: "Which embedding model would you like to use?",
        choices: Object.keys(EMBEDDING_MODELS).map(toChoice),
      },
    ]);
    config.embeddingModel = embeddingModel;
    config.dimensions =
      EMBEDDING_MODELS[
        embeddingModel as HuggingFaceEmbeddingModelType
      ].dimensions;
  }

  return config;
}
