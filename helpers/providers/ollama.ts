import ciInfo from "ci-info";
import ollama, { type ModelResponse } from "ollama";
import { red } from "picocolors";
import prompts from "prompts";
import { ModelConfigParams } from ".";
import { questionHandlers, toChoice } from "../../questions";

type ModelData = {
  dimensions: number;
};
const MODELS = ["llama3:8b", "wizardlm2:7b", "gemma:7b", "phi3"];
const DEFAULT_MODEL = MODELS[0];
// TODO: get embedding vector dimensions from the ollama sdk (currently not supported)
const EMBEDDING_MODELS: Record<string, ModelData> = {
  "nomic-embed-text": { dimensions: 768 },
  "mxbai-embed-large": { dimensions: 1024 },
  "all-minilm": { dimensions: 384 },
};
const DEFAULT_EMBEDDING_MODEL: string = Object.keys(EMBEDDING_MODELS)[0];

type OllamaQuestionsParams = {
  askModels: boolean;
};

export async function askOllamaQuestions({
  askModels,
}: OllamaQuestionsParams): Promise<ModelConfigParams> {
  const config: ModelConfigParams = {
    model: DEFAULT_MODEL,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    dimensions: EMBEDDING_MODELS[DEFAULT_EMBEDDING_MODEL].dimensions,
  };

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
    await ensureModel(model);
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
    await ensureModel(embeddingModel);
    config.embeddingModel = embeddingModel;
    config.dimensions = EMBEDDING_MODELS[embeddingModel].dimensions;
  }

  return config;
}

async function ensureModel(modelName: string) {
  try {
    if (modelName.split(":").length === 1) {
      // model doesn't have a version suffix, use latest
      modelName = modelName + ":latest";
    }
    const { models } = await ollama.list();
    const found =
      models.find((model: ModelResponse) => model.name === modelName) !==
      undefined;
    if (!found) {
      console.log(
        red(
          `Model ${modelName} was not pulled yet. Call 'ollama pull ${modelName}' and try again.`,
        ),
      );
      process.exit(1);
    }
  } catch (error) {
    console.log(
      red("Listing Ollama models failed. Is 'ollama' running? " + error),
    );
    process.exit(1);
  }
}
