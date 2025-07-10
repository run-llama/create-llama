import { PackageManager } from "../helpers/get-pkg-manager";

export type ModelProvider =
  | "openai"
  | "groq"
  | "ollama"
  | "anthropic"
  | "gemini"
  | "mistral"
  | "azure-openai"
  | "huggingface"
  | "t-systems";
export type ModelConfig = {
  provider: ModelProvider;
  apiKey?: string;
  model: string;
  embeddingModel: string;
  dimensions: number;
  isConfigured(): boolean;
};
export type TemplateType = "llamaindexserver";
export type TemplateFramework = "nextjs" | "express" | "fastapi";
export type TemplateVectorDB =
  | "none"
  | "mongo"
  | "pg"
  | "pinecone"
  | "milvus"
  | "astra"
  | "qdrant"
  | "chroma"
  | "llamacloud"
  | "weaviate";
export type TemplatePostInstallAction =
  | "none"
  | "VSCode"
  | "dependencies"
  | "runApp";
export type TemplateDataSource = {
  type: TemplateDataSourceType;
  config: TemplateDataSourceConfig;
};
export type TemplateDataSourceType = "file" | "web" | "db";
export type TemplateUseCase =
  | "financial_report"
  | "deep_research"
  | "agentic_rag"
  | "code_generator"
  | "document_generator"
  | "hitl";

export const ALL_TYPESCRIPT_USE_CASES: TemplateUseCase[] = [
  "agentic_rag",
  "deep_research",
  "financial_report",
  "code_generator",
  "document_generator",
  "hitl",
];

export const ALL_PYTHON_USE_CASES: TemplateUseCase[] = [
  "agentic_rag",
  "deep_research",
  "financial_report",
  "code_generator",
  "document_generator",
];

// Config for both file and folder
export type FileSourceConfig =
  | {
      path: string;
      filename?: string;
    }
  | {
      url: URL;
      filename?: string;
    };
export type WebSourceConfig = {
  baseUrl?: string;
  prefix?: string;
  depth?: number;
};
export type DbSourceConfig = {
  uri?: string;
  queries?: string;
};

export type TemplateDataSourceConfig =
  | FileSourceConfig
  | WebSourceConfig
  | DbSourceConfig;

export interface InstallTemplateArgs {
  appName: string;
  root: string;
  packageManager: PackageManager;
  template: TemplateType;
  framework: TemplateFramework;
  dataSources: TemplateDataSource[];
  modelConfig: ModelConfig;
  llamaCloudKey?: string;
  useLlamaParse: boolean;
  vectorDb: TemplateVectorDB;
  port?: number;
  postInstallAction: TemplatePostInstallAction;
  useCase: TemplateUseCase;
}
