import fs from "fs/promises";
import path from "path";
import {
  EnvVar,
  InstallTemplateArgs,
  ModelConfig,
  TemplateFramework,
  TemplateType,
  TemplateUseCase,
  TemplateVectorDB,
} from "./types";

import { TSYSTEMS_LLMHUB_API_URL } from "./providers/llmhub";
import { USE_CASE_CONFIGS } from "./use-case";

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
  template?: TemplateType,
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
            "For generating a connection URI, see https://supabase.com/vector\nThe PostgreSQL connection string.",
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
    case "llamacloud":
      return [
        {
          name: "LLAMA_CLOUD_INDEX_NAME",
          description:
            "The name of the LlamaCloud index to use (part of the LlamaCloud project).",
          value: "test",
        },
        {
          name: "LLAMA_CLOUD_PROJECT_NAME",
          description: "The name of the LlamaCloud project.",
          value: "Default",
        },
        {
          name: "LLAMA_CLOUD_BASE_URL",
          description:
            "The base URL for the LlamaCloud API. Only change this for non-production environments",
          value: "https://api.cloud.llamaindex.ai",
        },
        {
          name: "LLAMA_CLOUD_ORGANIZATION_ID",
          description:
            "The organization ID for the LlamaCloud project (uses default organization if not specified)",
        },
        ...(framework === "nextjs" && template !== "llamaindexserver"
          ? // activate index selector per default (not needed for non-NextJS backends as it's handled by createFrontendEnvFile)
            [
              {
                name: "NEXT_PUBLIC_USE_LLAMACLOUD",
                description:
                  "Let's the user change indexes in LlamaCloud projects",
                value: "true",
              },
            ]
          : []),
      ];
    case "chroma": {
      const envs = [
        {
          name: "CHROMA_COLLECTION",
          description: "The name of the collection in your Chroma database",
        },
        {
          name: "CHROMA_HOST",
          description: "The hostname for your Chroma database. Eg: localhost",
        },
        {
          name: "CHROMA_PORT",
          description: "The port for your Chroma database. Eg: 8000",
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
    }
    case "weaviate":
      return [
        {
          name: "WEAVIATE_CLUSTER_URL",
          description:
            "The URL of the Weaviate cloud cluster, see: https://weaviate.io/developers/wcs/connect",
        },
        {
          name: "WEAVIATE_API_KEY",
          description: "The API key for the Weaviate cloud cluster",
        },
        {
          name: "WEAVIATE_INDEX_NAME",
          description:
            "(Optional) The collection name to use, default is LlamaIndex if not specified",
        },
      ];
    default:
      return template !== "llamaindexserver"
        ? [
            {
              name: "STORAGE_CACHE_DIR",
              description: "The directory to store the local storage cache.",
              value: ".cache",
            },
          ]
        : [];
  }
};

const getModelEnvs = (
  modelConfig: ModelConfig,
  framework: TemplateFramework,
  template: TemplateType,
  useCase: TemplateUseCase,
): EnvVar[] => {
  const isPythonLlamaDeploy =
    framework === "fastapi" && template === "llamaindexserver";

  return [
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
    ...(isPythonLlamaDeploy
      ? [
          {
            name: "NEXT_PUBLIC_STARTER_QUESTIONS",
            description:
              "Initial questions to display in the chat (`starterQuestions`)",
            value: JSON.stringify(
              USE_CASE_CONFIGS[useCase]?.starterQuestions ?? [],
            ),
          },
        ]
      : [
          {
            name: "CONVERSATION_STARTERS",
            description:
              "The questions to help users get started (multi-line).",
          },
        ]),
    ...(USE_CASE_CONFIGS[useCase]?.additionalEnvVars ?? []),
    ...(modelConfig.provider === "openai"
      ? [
          {
            name: "OPENAI_API_KEY",
            description: "The OpenAI API key to use.",
            value: modelConfig.apiKey,
          },
          ...(isPythonLlamaDeploy
            ? []
            : [
                {
                  name: "LLM_TEMPERATURE",
                  description: "Temperature for sampling from the model.",
                },
                {
                  name: "LLM_MAX_TOKENS",
                  description: "Maximum number of tokens to generate.",
                },
              ]),
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
    ...(modelConfig.provider === "groq"
      ? [
          {
            name: "GROQ_API_KEY",
            description: "The Groq API key to use.",
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
    ...(modelConfig.provider === "mistral"
      ? [
          {
            name: "MISTRAL_API_KEY",
            description: "The Mistral API key to use.",
            value: modelConfig.apiKey,
          },
        ]
      : []),
    ...(modelConfig.provider === "azure-openai"
      ? [
          {
            name: "AZURE_OPENAI_API_KEY",
            description: "The Azure OpenAI key to use.",
            value: modelConfig.apiKey,
          },
          {
            name: "AZURE_OPENAI_ENDPOINT",
            description: "The Azure OpenAI endpoint to use.",
          },
          {
            name: "AZURE_OPENAI_API_VERSION",
            description: "The Azure OpenAI API version to use.",
          },
          {
            name: "AZURE_OPENAI_LLM_DEPLOYMENT",
            description:
              "The Azure OpenAI deployment to use for LLM deployment.",
          },
          {
            name: "AZURE_OPENAI_EMBEDDING_DEPLOYMENT",
            description:
              "The Azure OpenAI deployment to use for embedding deployment.",
          },
        ]
      : []),
    ...(modelConfig.provider === "huggingface"
      ? [
          {
            name: "EMBEDDING_BACKEND",
            description:
              "The backend to use for the Sentence Transformers embedding model, either 'torch', 'onnx', or 'openvino'. Defaults to 'onnx'.",
          },
          {
            name: "EMBEDDING_TRUST_REMOTE_CODE",
            description:
              "Whether to trust remote code for the embedding model, required for some models with custom code.",
          },
        ]
      : []),
    ...(modelConfig.provider === "t-systems"
      ? [
          {
            name: "T_SYSTEMS_LLMHUB_BASE_URL",
            description:
              "The base URL for the T-Systems AI Foundation Model API. Eg: http://localhost:11434",
            value: TSYSTEMS_LLMHUB_API_URL,
          },
          {
            name: "T_SYSTEMS_LLMHUB_API_KEY",
            description: "API Key for T-System's AI Foundation Model.",
            value: modelConfig.apiKey,
          },
        ]
      : []),
  ];
};

const getFrameworkEnvs = (
  framework: TemplateFramework,
  template?: TemplateType,
  port?: number,
): EnvVar[] => {
  const sPort = port?.toString() || "8000";
  const result: EnvVar[] = [];
  if (framework === "fastapi" && template !== "llamaindexserver") {
    result.push(
      ...[
        {
          name: "APP_HOST",
          description: "The address to start the FastAPI app.",
          value: "0.0.0.0",
        },
        {
          name: "APP_PORT",
          description: "The port to start the FastAPI app.",
          value: sPort,
        },
      ],
    );
  }

  return result;
};

export const createBackendEnvFile = async (
  root: string,
  opts: Pick<
    InstallTemplateArgs,
    | "llamaCloudKey"
    | "vectorDb"
    | "modelConfig"
    | "framework"
    | "dataSources"
    | "template"
    | "port"
    | "useLlamaParse"
    | "useCase"
  >,
) => {
  // Init env values
  const envFileName = ".env";
  const envVars: EnvVar[] = [
    ...(opts.useLlamaParse
      ? [
          {
            name: "LLAMA_CLOUD_API_KEY",
            description: `The Llama Cloud API key.`,
            value: opts.llamaCloudKey,
          },
        ]
      : []),
    ...getVectorDBEnvs(opts.vectorDb, opts.framework, opts.template),
    ...getFrameworkEnvs(opts.framework, opts.template, opts.port),
    ...getModelEnvs(
      opts.modelConfig,
      opts.framework,
      opts.template,
      opts.useCase,
    ),
  ];
  // Render and write env file
  const content = renderEnvVar(envVars);

  const isPythonLlamaDeploy =
    opts.framework === "fastapi" && opts.template === "llamaindexserver";

  // each llama-deploy service will need a .env inside its directory
  // this .env will be copied along with workflow code when service is deployed
  // so that we need to put the .env file inside src/ instead of root
  const envPath = isPythonLlamaDeploy
    ? path.join(root, "src", envFileName)
    : path.join(root, envFileName);

  await fs.writeFile(envPath, content);
  console.log(`Created '${envFileName}' file. Please check the settings.`);
};
