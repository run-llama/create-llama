import ciInfo from "ci-info";
import prompts from "prompts";
import { ModelConfigParams } from ".";
import { questionHandlers, toChoice } from "../../questions";

const MODELS = [
  "llama3-8b",
  "llama3-70b",
  "mixtral-8x7b",
  "llama-3.1-70b",
  "llama-3.1-8b",
  "llama3-groq-70b-tool-use",
  "llama3-groq-8b-tool-use",
  "gemma2-9b-it",
  "gemma-7b-it",
  "llava-v1.5-7b",
];
const DEFAULT_MODEL = MODELS[0];

// Use huggingface embedding models for now as Groq doesn't support embedding models
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

type GroqQuestionsParams = {
  apiKey?: string;
  askModels: boolean;
};

export async function askGroqQuestions({
  askModels,
  apiKey,
}: GroqQuestionsParams): Promise<ModelConfigParams> {
  const config: ModelConfigParams = {
    apiKey,
    model: DEFAULT_MODEL,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    dimensions: DEFAULT_DIMENSIONS,
    isConfigured(): boolean {
      if (config.apiKey) {
        return true;
      }
      if (process.env["GROQ_API_KEY"]) {
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
          "Please provide your Groq API key (or leave blank to use GROQ_API_KEY env variable):",
      },
      questionHandlers,
    );
    config.apiKey = key || process.env.GROQ_API_KEY;
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
