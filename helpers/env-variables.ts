import fs from "fs/promises";
import path from "path";
import { TOOL_SYSTEM_PROMPT_ENV_VAR, Tool } from "./tools";
import {
  ModelConfig,
  TemplateDataSource,
  TemplateFramework,
  TemplateVectorDB,
} from "./types";

export type EnvVar = {
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

const getVectorDBEnvs = (
  vectorDb?: TemplateVectorDB,
  framework?: TemplateFramework,
): EnvVar[] => {
  if (!vectorDb || !framework) {
    return [];
  }
  switch (vectorDb) {
    case "mongo":
      return [
        {
          name: "MONGODB_URI",
          description:
            "For generating a connection URI, see https://www.mongodb.com/docs/manual/reference/connection-string/ \nThe MongoDB connection URI.",
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
    case "chroma":
      const envs = [
        {
          name: "CHROMA_COLLECTION",
          description: "The name of the collection in your Chroma database",
        },
        {
          name: "CHROMA_HOST",
          description: "The API endpoint for your Chroma database",
        },
        {
          name: "CHROMA_PORT",
          description: "The port for your Chroma database",
        },
      ];
      // TS Version doesn't support config local storage path
      if (framework === "fastapi") {
        envs.push({
          name: "CHROMA_PATH",
          description: `The local path to the Chroma database. 
Specify this if you are using a local Chroma database. 
Otherwise, use CHROMA_HOST and CHROMA_PORT config above`,
        });
      }
      return envs;
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
    ...(modelConfig.provider === "anthropic"
      ? [
          {
            name: "ANTHROPIC_API_KEY",
            description: "The Anthropic API key to use.",
            value: modelConfig.apiKey,
          },
        ]
      : []),
    ...(modelConfig.provider === "gemini"
      ? [
          {
            name: "GOOGLE_API_KEY",
            description: "The Google API key to use.",
            value: modelConfig.apiKey,
          },
        ]
      : []),
    ...(modelConfig.provider === "ollama"
      ? [
          {
            name: "OLLAMA_BASE_URL",
            description:
              "The base URL for the Ollama API. Eg: http://127.0.0.1:11434",
          },
        ]
      : []),
  ];
};

const getFrameworkEnvs = (
  framework: TemplateFramework,
  port?: number,
): EnvVar[] => {
  const sPort = port?.toString() || "8000";
  const result: EnvVar[] = [
    {
      name: "FILESERVER_URL_PREFIX",
      description:
        "FILESERVER_URL_PREFIX is the URL prefix of the server storing the images generated by the interpreter.",
      value:
        framework === "nextjs"
          ? // FIXME: if we are using nextjs, port should be 3000
            "http://localhost:3000/api/files"
          : `http://localhost:${sPort}/api/files`,
    },
  ];
  if (framework === "fastapi") {
    result.push(
      ...[
        {
          name: "APP_HOST",
          description: "The address to start the backend app.",
          value: "0.0.0.0",
        },
        {
          name: "APP_PORT",
          description: "The port to start the backend app.",
          value: sPort,
        },
      ],
    );
  }
  return result;
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

const getToolEnvs = (tools?: Tool[]): EnvVar[] => {
  if (!tools?.length) return [];
  const toolEnvs: EnvVar[] = [];
  tools.forEach((tool) => {
    if (tool.envVars?.length) {
      toolEnvs.push(
        // Don't include the system prompt env var here
        // It should be handled separately by merging with the default system prompt
        ...tool.envVars.filter(
          (env) => env.name !== TOOL_SYSTEM_PROMPT_ENV_VAR,
        ),
      );
    }
  });
  return toolEnvs;
};

const getSystemPromptEnv = (tools?: Tool[]): EnvVar => {
  const defaultSystemPrompt =
    "You are a helpful assistant who helps users with their questions.";

  // build tool system prompt by merging all tool system prompts
  let toolSystemPrompt = "";
  tools?.forEach((tool) => {
    const toolSystemPromptEnv = tool.envVars?.find(
      (env) => env.name === TOOL_SYSTEM_PROMPT_ENV_VAR,
    );
    if (toolSystemPromptEnv) {
      toolSystemPrompt += toolSystemPromptEnv.value + "\n";
    }
  });

  const systemPrompt = toolSystemPrompt
    ? `\"${toolSystemPrompt}\"`
    : defaultSystemPrompt;

  return {
    name: "SYSTEM_PROMPT",
    description: "The system prompt for the AI model.",
    value: systemPrompt,
  };
};

export const createBackendEnvFile = async (
  root: string,
  opts: {
    llamaCloudKey?: string;
    vectorDb?: TemplateVectorDB;
    modelConfig: ModelConfig;
    framework: TemplateFramework;
    dataSources?: TemplateDataSource[];
    port?: number;
    tools?: Tool[];
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
    ...getVectorDBEnvs(opts.vectorDb, opts.framework),
    ...getFrameworkEnvs(opts.framework, opts.port),
    ...getToolEnvs(opts.tools),
    getSystemPromptEnv(opts.tools),
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
