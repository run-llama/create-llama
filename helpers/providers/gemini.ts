import ciInfo from "ci-info";
import prompts from "prompts";
import { ModelConfigParams } from ".";
import { questionHandlers, toChoice } from "../../questions";

// TODO: get embedding vector dimensions from the google sdk (currently not supported)
// Gemini has the same name for the model and the embedding model
// Get dimensions data from: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/models#gemini-models
const MODELS: Record<
  string,
  {
    dimensions: number;
  }
> = {
  "gemini-pro": { dimensions: 2048 },
  "gemini-pro-vision": { dimensions: 4096 },
  // TODO: we can add more models here, but make sure it works for both typescript & python settings too
};

const DEFAULT_MODEL = Object.keys(MODELS)[0];
const DEFAULT_DIMENSIONS = Object.values(MODELS)[0].dimensions;

type GeminiQuestionsParams = {
  apiKey?: string;
  askModels: boolean;
};

export async function askGeminiQuestions({
  askModels,
  apiKey,
}: GeminiQuestionsParams): Promise<ModelConfigParams> {
  const config: ModelConfigParams = {
    apiKey,
    model: DEFAULT_MODEL,
    embeddingModel: DEFAULT_MODEL,
    dimensions: DEFAULT_DIMENSIONS,
  };

  if (!config.apiKey) {
    const { key } = await prompts(
      {
        type: "text",
        name: "key",
        message: askModels
          ? "Please provide your GOOGLE API key (or leave blank to use env variable):"
          : "Please provide your GOOGLE API key (leave blank to skip):",
      },
      questionHandlers,
    );
    config.apiKey = key || process.env.GOOGLE_API_KEY;
  }

  // use default model values in CI or if user should not be asked
  const useDefaults = ciInfo.isCI || !askModels;
  if (!useDefaults) {
    const { model } = await prompts(
      {
        type: "select",
        name: "model",
        message:
          "Which Gemini model would you like to use for llm and embedding?",
        choices: Object.keys(MODELS).map(toChoice),
        initial: 0,
      },
      questionHandlers,
    );
    config.model = model;
    config.embeddingModel = model;
    config.dimensions = MODELS[model].dimensions;
  }

  return config;
}
