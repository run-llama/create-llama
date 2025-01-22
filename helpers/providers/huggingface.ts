import inquirer from "inquirer";
import { ModelConfigParams } from ".";
import { toChoice } from "../../questions/utils";

const MODELS = ["HuggingFaceH4/zephyr-7b-alpha"];
type ModelData = {
  dimensions: number;
};
const EMBEDDING_MODELS: Record<string, ModelData> = {
  "BAAI/bge-small-en-v1.5": { dimensions: 384 },
  "BAAI/bge-base-en-v1.5": { dimensions: 768 },
  "BAAI/bge-large-en-v1.5": { dimensions: 1024 },
  "sentence-transformers/all-MiniLM-L6-v2": { dimensions: 384 },
  "sentence-transformers/all-mpnet-base-v2": { dimensions: 768 },
  "intfloat/multilingual-e5-large": { dimensions: 1024 },
  "mixedbread-ai/mxbai-embed-large-v1": { dimensions: 1024 },
  "nomic-ai/nomic-embed-text-v1.5": { dimensions: 768 },
};

const DEFAULT_MODEL = MODELS[0];
const DEFAULT_EMBEDDING_MODEL = Object.keys(EMBEDDING_MODELS)[0];
const DEFAULT_DIMENSIONS = Object.values(EMBEDDING_MODELS)[0].dimensions;

type HuggingfaceQuestionsParams = {
  askModels: boolean;
};

export async function askHuggingfaceQuestions({
  askModels,
}: HuggingfaceQuestionsParams): Promise<ModelConfigParams> {
  const config: ModelConfigParams = {
    model: DEFAULT_MODEL,
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    dimensions: DEFAULT_DIMENSIONS,
    isConfigured(): boolean {
      return true;
    },
  };

  if (askModels) {
    const { model } = await inquirer.prompt([
      {
        type: "list",
        name: "model",
        message: "Which Hugging Face model would you like to use?",
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
