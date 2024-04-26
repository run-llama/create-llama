import fs from "fs/promises";
import path from "path";
import {
  ModelConfig,
  TemplateDataSource,
  TemplateFramework,
  TemplateVectorDB,
} from "./types";

type EnvVar = {
  name?: string;
  description?: string;
  value?: string;
};

const renderEnvVar = (envVars: EnvVar[]): string => {
  return envVars.reduce(
    (prev, env) =>
      prev +
      (env.description
        ? `# ${env.description.replaceAll("\n", "\n# ")}\n`
        : "") +
      (env.name
        ? env.value
          ? `${env.name}=${env.value}\n\n`
          : `# ${env.name}=\n\n`
        : ""),
    "",
  );
};

const getVectorDBEnvs = (vectorDb?: TemplateVectorDB): EnvVar[] => {
  if (!vectorDb) {
    return [];
  }
  switch (vectorDb) {
    case "mongo":
      return [
        {
          name: "MONGO_URI",
          description:
            "For generating a connection URI, see https://docs.timescale.com/use-timescale/latest/services/create-a-service\nThe MongoDB connection URI.",
        },
        {
          name: "MONGODB_DATABASE",
        },
        {
          name: "MONGODB_VECTORS",
        },
        {
          name: "MONGODB_VECTOR_INDEX",
        },
      ];
    case "pg":
      return [
        {
          name: "PG_CONNECTION_STRING",
          description:
            "For generating a connection URI, see https://docs.timescale.com/use-timescale/latest/services/create-a-service\nThe PostgreSQL connection string.",
        },
      ];

    case "pinecone":
      return [
        {
          name: "PINECONE_API_KEY",
          description:
            "Configuration for Pinecone vector store\nThe Pinecone API key.",
        },
        {
          name: "PINECONE_ENVIRONMENT",
        },
        {
          name: "PINECONE_INDEX_NAME",
        },
      ];
    case "milvus":
      return [
        {
          name: "MILVUS_ADDRESS",
          description:
            "The address of the Milvus server. Eg: http://localhost:19530",
          value: "http://localhost:19530",
        },
        {
          name: "MILVUS_COLLECTION",
          description:
            "The name of the Milvus collection to store the vectors.",
          value: "llamacollection",
        },
        {
          name: "MILVUS_USERNAME",
          description: "The username to access the Milvus server.",
        },
        {
          name: "MILVUS_PASSWORD",
          description: "The password to access the Milvus server.",
        },
      ];
    case "astra":
      return [
        {
          name: "ASTRA_DB_APPLICATION_TOKEN",
          description: "The generated app token for your Astra database",
        },
        {
          name: "ASTRA_DB_ENDPOINT",
          description: "The API endpoint for your Astra database",
        },
        {
          name: "ASTRA_DB_COLLECTION",
          description: "The name of the collection in your Astra database",
        },
      ];
    case "qdrant":
      return [
        {
          name: "QDRANT_URL",
          description:
            "The qualified REST URL of the Qdrant server. Eg: http://localhost:6333",
        },
        {
          name: "QDRANT_COLLECTION",
          description: "The name of Qdrant collection to use.",
        },
        {
          name: "QDRANT_API_KEY",
          description:
            "Optional API key for authenticating requests to Qdrant.",
        },
      ];
    default:
      return [];
  }
};

const getModelEnvs = (modelConfig: ModelConfig): EnvVar[] => {
  return [
    {
      name: "MODEL_PROVIDER",
      description: "The provider for the AI models to use.",
      value: modelConfig.provider,
    },
    {
      name: "MODEL",
      description: "The name of LLM model to use.",
      value: modelConfig.model,
    },
    {
      name: "EMBEDDING_MODEL",
      description: "Name of the embedding model to use.",
      value: modelConfig.embeddingModel,
    },
    {
      name: "EMBEDDING_DIM",
      description: "Dimension of the embedding model to use.",
      value: modelConfig.dimensions.toString(),
    },
    ...(modelConfig.provider === "openai"
      ? [
          {
            name: "OPENAI_API_KEY",
            description: "The OpenAI API key to use.",
            value: modelConfig.apiKey,
          },
          {
            name: "LLM_TEMPERATURE",
            description: "Temperature for sampling from the model.",
          },
          {
            name: "LLM_MAX_TOKENS",
            description: "Maximum number of tokens to generate.",
          },
        ]
      : []),
  ];
};

const getFrameworkEnvs = (
  framework?: TemplateFramework,
  port?: number,
): EnvVar[] => {
  if (framework !== "fastapi") {
    return [];
  }
  return [
    {
      name: "APP_HOST",
      description: "The address to start the backend app.",
      value: "0.0.0.0",
    },
    {
      name: "APP_PORT",
      description: "The port to start the backend app.",
      value: port?.toString() || "8000",
    },
    // TODO: Once LlamaIndexTS supports string templates, move this to `getEngineEnvs`
    {
      name: "SYSTEM_PROMPT",
      description: `Custom system prompt.
Example:
SYSTEM_PROMPT="
We have provided context information below.
---------------------
{context_str}
---------------------
Given this information, please answer the question: {query_str}
"`,
    },
  ];
};

const getEngineEnvs = (): EnvVar[] => {
  return [
    {
      name: "TOP_K",
      description:
        "The number of similar embeddings to return when retrieving documents.",
      value: "3",
    },
  ];
};

export const createBackendEnvFile = async (
  root: string,
  opts: {
    llamaCloudKey?: string;
    vectorDb?: TemplateVectorDB;
    modelConfig: ModelConfig;
    framework?: TemplateFramework;
    dataSources?: TemplateDataSource[];
    port?: number;
  },
) => {
  // Init env values
  const envFileName = ".env";
  const envVars: EnvVar[] = [
    {
      name: "LLAMA_CLOUD_API_KEY",
      description: `The Llama Cloud API key.`,
      value: opts.llamaCloudKey,
    },
    // Add model environment variables
    ...getModelEnvs(opts.modelConfig),
    // Add engine environment variables
    ...getEngineEnvs(),
    // Add vector database environment variables
    ...getVectorDBEnvs(opts.vectorDb),
    ...getFrameworkEnvs(opts.framework, opts.port),
  ];
  // Render and write env file
  const content = renderEnvVar(envVars);
  await fs.writeFile(path.join(root, envFileName), content);
  console.log(`Created '${envFileName}' file. Please check the settings.`);
};

export const createFrontendEnvFile = async (
  root: string,
  opts: {
    customApiPath?: string;
  },
) => {
  const defaultFrontendEnvs = [
    {
      name: "NEXT_PUBLIC_CHAT_API",
      description: "The backend API for chat endpoint.",
      value: opts.customApiPath
        ? opts.customApiPath
        : "http://localhost:8000/api/chat",
    },
  ];
  const content = renderEnvVar(defaultFrontendEnvs);
  await fs.writeFile(path.join(root, ".env"), content);
};
