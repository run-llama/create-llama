import prompts from "prompts";
import { ModelConfigParams } from ".";
import { questionHandlers, toChoice } from "../../questions/utils";

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

export async function askGroqQuestions(): Promise<ModelConfigParams> {
  const config: ModelConfigParams = {
    apiKey: process.env.GROQ_API_KEY,
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

  const modelChoices = await getAvailableModelChoicesGroq(config.apiKey!);

  const { model } = await prompts(
    {
      type: "select",
      name: "model",
      message: "Which LLM model would you like to use?",
      choices: modelChoices,
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

  return config;
}
