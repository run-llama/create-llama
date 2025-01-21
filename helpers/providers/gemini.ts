import inquirer from "inquirer";
import { ModelConfigParams } from ".";
import { toChoice } from "../../questions/utils";

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
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    dimensions: DEFAULT_DIMENSIONS,
    isConfigured(): boolean {
      if (config.apiKey) {
        return true;
      }
      if (process.env["GOOGLE_API_KEY"]) {
        return true;
      }
      return false;
    },
  };

  if (!config.apiKey) {
    const { key } = await inquirer.prompt([
      {
        type: "input",
        name: "key",
        message: askModels
          ? "Please provide your Google API key (or leave blank to use GOOGLE_API_KEY env variable):"
          : "Please provide your Google API key (leave blank to skip):",
        validate: (value: string) => {
          if (askModels && !value) {
            if (process.env.GOOGLE_API_KEY) {
              return true;
            }
            return "GOOGLE_API_KEY env variable is not set - key is required";
          }
          return true;
        },
      },
    ]);
    config.apiKey = key || process.env.GOOGLE_API_KEY;
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
    config.dimensions = EMBEDDING_MODELS[embeddingModel].dimensions;
  }

  return config;
}
