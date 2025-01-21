import inquirer from "inquirer";
import { ModelConfigParams } from ".";
import { toChoice } from "../../questions/utils";

import got from "got";
import ora from "ora";
import { red } from "picocolors";

const GROQ_API_URL = "https://api.groq.com/openai/v1";

async function getAvailableModelChoicesGroq(apiKey: string) {
  if (!apiKey) {
    throw new Error("Need Groq API key to retrieve model choices");
  }

  const spinner = ora("Fetching available models from Groq").start();
  try {
    const response = await got(`${GROQ_API_URL}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 5000,
      responseType: "json",
    });
    const data: any = await response.body;
    spinner.stop();

    // Filter out the Whisper models
    return data.data
      .filter((model: any) => !model.id.toLowerCase().includes("whisper"))
      .map((el: any) => {
        return {
          title: el.id,
          value: el.id,
        };
      });
  } catch (error: unknown) {
    spinner.stop();
    console.log(error);
    if ((error as any).response?.statusCode === 401) {
      console.log(
        red(
          "Invalid Groq API key provided! Please provide a valid key and try again!",
        ),
      );
    } else {
      console.log(red("Request failed: " + error));
    }
    process.exit(1);
  }
}

const DEFAULT_MODEL = "llama3-70b-8192";

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
    const { key } = await inquirer.prompt([
      {
        type: "input",
        name: "key",
        message: askModels
          ? "Please provide your Groq API key (or leave blank to use GROQ_API_KEY env variable):"
          : "Please provide your Groq API key (leave blank to skip):",
        validate: (value: string) => {
          if (askModels && !value) {
            if (process.env.GROQ_API_KEY) {
              return true;
            }
            return "GROQ_API_KEY env variable is not set - key is required";
          }
          return true;
        },
      },
    ]);
    config.apiKey = key || process.env.GROQ_API_KEY;
  }

  if (askModels) {
    const modelChoices = await getAvailableModelChoicesGroq(config.apiKey!);

    const { model } = await inquirer.prompt([
      {
        type: "list",
        name: "model",
        message: "Which LLM model would you like to use?",
        choices: modelChoices,
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
