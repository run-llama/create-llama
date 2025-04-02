import fs from "fs/promises";
import path from "path";
import { TOOL_SYSTEM_PROMPT_ENV_VAR, Tool } from "./tools";
import {
  InstallTemplateArgs,
  ModelConfig,
  TemplateDataSource,
  TemplateFramework,
  TemplateObservability,
  TemplateType,
  TemplateVectorDB,
} from "./types";

import { TSYSTEMS_LLMHUB_API_URL } from "./providers/llmhub";

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant who helps users with their questions.";

const DATA_SOURCES_PROMPT =
  "You have access to a knowledge base including the facts that you should start with to find the answer for the user question. Use the query engine tool to retrieve the facts from the knowledge base.";

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
    case "chroma":
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
      return framework !== "fastapi"
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
    {
      name: "CONVERSATION_STARTERS",
      description: "The questions to help users get started (multi-line).",
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
  template: TemplateType,
  port?: number,
): EnvVar[] => {
  const sPort = port?.toString() || "8000";
  const result: EnvVar[] =
    template !== "llamaindexserver"
      ? [
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
        ]
      : [];
  if (framework === "fastapi") {
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
  if (framework === "nextjs" && template !== "llamaindexserver") {
    result.push({
      name: "NEXT_PUBLIC_CHAT_API",
      description:
        "The API for the chat endpoint. Set when using a custom backend (e.g. Express). Use full URL like http://localhost:8000/api/chat",
    });
  }
  return result;
};

const getEngineEnvs = (): EnvVar[] => {
  return [
    {
      name: "TOP_K",
      description:
        "The number of similar embeddings to return when retrieving documents.",
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

const getSystemPromptEnv = (
  tools?: Tool[],
  dataSources?: TemplateDataSource[],
  template?: TemplateType,
): EnvVar[] => {
  const systemPromptEnv: EnvVar[] = [];
  // build tool system prompt by merging all tool system prompts
  // multiagent template doesn't need system prompt
  if (template !== "multiagent") {
    let toolSystemPrompt = "";
    tools?.forEach((tool) => {
      const toolSystemPromptEnv = tool.envVars?.find(
        (env) => env.name === TOOL_SYSTEM_PROMPT_ENV_VAR,
      );
      if (toolSystemPromptEnv) {
        toolSystemPrompt += toolSystemPromptEnv.value + "\n";
      }
    });

    const systemPrompt =
      '"' +
      DEFAULT_SYSTEM_PROMPT +
      (dataSources?.length ? `\n${DATA_SOURCES_PROMPT}` : "") +
      (toolSystemPrompt ? `\n${toolSystemPrompt}` : "") +
      '"';

    systemPromptEnv.push({
      name: "SYSTEM_PROMPT",
      description: "The system prompt for the AI model.",
      value: systemPrompt,
    });
  }
  if (tools?.length == 0 && (dataSources?.length ?? 0 > 0)) {
    const citationPrompt = `'You have provided information from a knowledge base that has been passed to you in nodes of information.
Each node has useful metadata such as node ID, file name, page, etc.
Please add the citation to the data node for each sentence or paragraph that you reference in the provided information.
The citation format is: . [citation:<node_id>]()
Where the <node_id> is the unique identifier of the data node.

Example:
We have two nodes:
  node_id: xyz
  file_name: llama.pdf
  
  node_id: abc
  file_name: animal.pdf

User question: Tell me a fun fact about Llama.
Your answer:
A baby llama is called "Cria" [citation:xyz]().
It often live in desert [citation:abc]().
It\\'s cute animal.
'`;
    systemPromptEnv.push({
      name: "SYSTEM_CITATION_PROMPT",
      description:
        "An additional system prompt to add citation when responding to user questions.",
      value: citationPrompt,
    });
  }

  return systemPromptEnv;
};

const getTemplateEnvs = (template?: TemplateType): EnvVar[] => {
  const nextQuestionEnvs: EnvVar[] = [
    {
      name: "NEXT_QUESTION_PROMPT",
      description: `Customize prompt to generate the next question suggestions based on the conversation history.
Disable this prompt to disable the next question suggestions feature.`,
      value: `"You're a helpful assistant! Your task is to suggest the next question that user might ask. 
Here is the conversation history
---------------------
{conversation}
---------------------
Given the conversation history, please give me 3 questions that user might ask next!
Your answer should be wrapped in three sticks which follows the following format:
\`\`\`
<question 1>
<question 2>
<question 3>
\`\`\`"`,
    },
  ];

  if (template === "multiagent" || template === "streaming") {
    return nextQuestionEnvs;
  }
  return [];
};

const getObservabilityEnvs = (
  observability?: TemplateObservability,
): EnvVar[] => {
  if (observability === "llamatrace") {
    return [
      {
        name: "PHOENIX_API_KEY",
        description:
          "API key for LlamaTrace observability. Retrieve from https://llamatrace.com/login",
      },
    ];
  }
  return [];
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
    | "tools"
    | "observability"
    | "useLlamaParse"
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
    // Add environment variables of each component
    ...(opts.template !== "llamaindexserver"
      ? [...getModelEnvs(opts.modelConfig), ...getEngineEnvs()]
      : []),
    ...getVectorDBEnvs(opts.vectorDb, opts.framework, opts.template),
    ...getFrameworkEnvs(opts.framework, opts.template, opts.port),
    ...getToolEnvs(opts.tools),
    ...getTemplateEnvs(opts.template),
    ...getObservabilityEnvs(opts.observability),
    ...getSystemPromptEnv(opts.tools, opts.dataSources, opts.template),
  ];
  // Render and write env file
  const content = renderEnvVar(envVars);
  await fs.writeFile(path.join(root, envFileName), content);
  console.log(`Created '${envFileName}' file. Please check the settings.`);
};

export const createFrontendEnvFile = async (
  root: string,
  opts: {
    vectorDb?: TemplateVectorDB;
  },
) => {
  const defaultFrontendEnvs = [
    {
      name: "NEXT_PUBLIC_USE_LLAMACLOUD",
      description: "Let's the user change indexes in LlamaCloud projects",
      value: opts.vectorDb === "llamacloud" ? "true" : "false",
    },
  ];
  const content = renderEnvVar(defaultFrontendEnvs);
  await fs.writeFile(path.join(root, ".env"), content);
};
