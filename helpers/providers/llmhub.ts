import ciInfo from "ci-info";
import got from "got";
import ora from "ora";
import { red } from "picocolors";
import prompts from "prompts";
import { ModelConfigParams } from ".";
import { questionHandlers } from "../../questions";

export const TSYSTEMS_LLMHUB_API_URL =
  "https://llm-server.llmhub.t-systems.net/v2";

const DEFAULT_MODEL = "gpt-3.5-turbo";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large";

const LLMHUB_MODELS = [
  "gpt-35-turbo",
  "gpt-4-32k-1",
  "gpt-4-32k-canada",
  "gpt-4-32k-france",
  "gpt-4-turbo-128k-france",
  "Llama2-70b-Instruct",
  "Llama-3-70B-Instruct",
  "Mixtral-8x7B-Instruct-v0.1",
  "mistral-large-32k-france",
  "CodeLlama-2",
];
const LLMHUB_EMBEDDING_MODELS = [
  "text-embedding-ada-002",
  "text-embedding-ada-002-france",
  "jina-embeddings-v2-base-de",
  "jina-embeddings-v2-base-code",
  "text-embedding-bge-m3",
];

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
    dimensions: getDimensions(DEFAULT_EMBEDDING_MODEL),
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
        message: askModels
          ? "Please provide your LLMHub API key (or leave blank to use T_SYSTEMS_LLMHUB_API_KEY env variable):"
          : "Please provide your LLMHub API key (leave blank to skip):",
        validate: (value: string) => {
          if (askModels && !value) {
            if (process.env.T_SYSTEMS_LLMHUB_API_KEY) {
              return true;
            }
            return "T_SYSTEMS_LLMHUB_API_KEY env variable is not set - key is required";
          }
          return true;
        },
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
        choices: await getAvailableModelChoices(false, config.apiKey),
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
        choices: await getAvailableModelChoices(true, config.apiKey),
        initial: 0,
      },
      questionHandlers,
    );
    config.embeddingModel = embeddingModel;
    config.dimensions = getDimensions(embeddingModel);
  }

  return config;
}

async function getAvailableModelChoices(
  selectEmbedding: boolean,
  apiKey?: string,
) {
  if (!apiKey) {
    throw new Error("Need LLMHub key to retrieve model choices");
  }
  const isLLMModel = (modelId: string) => {
    return LLMHUB_MODELS.includes(modelId);
  };

  const isEmbeddingModel = (modelId: string) => {
    return LLMHUB_EMBEDDING_MODELS.includes(modelId);
  };

  const spinner = ora("Fetching available models").start();
  try {
    const response = await got(`${TSYSTEMS_LLMHUB_API_URL}/models`, {
      headers: {
        Authorization: "Bearer " + apiKey,
      },
      timeout: 5000,
      responseType: "json",
    });
    const data: any = await response.body;
    spinner.stop();
    return data.data
      .filter((model: any) =>
        selectEmbedding ? isEmbeddingModel(model.id) : isLLMModel(model.id),
      )
      .map((el: any) => {
        return {
          title: el.id,
          value: el.id,
        };
      });
  } catch (error) {
    spinner.stop();
    if ((error as any).response?.statusCode === 401) {
      console.log(
        red(
          "Invalid LLMHub API key provided! Please provide a valid key and try again!",
        ),
      );
    } else {
      console.log(red("Request failed: " + error));
    }
    process.exit(1);
  }
}

function getDimensions(modelName: string) {
  // Assuming dimensions similar to OpenAI for simplicity. Update if different.
  return modelName === "text-embedding-004" ? 768 : 1536;
}
