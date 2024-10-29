import { PackageManager } from "../helpers/get-pkg-manager";
import { Tool } from "./tools";

export type ModelProvider =
  | "openai"
  | "groq"
  | "ollama"
  | "anthropic"
  | "gemini"
  | "mistral"
  | "azure-openai"
  | "t-systems";
export type ModelConfig = {
  provider: ModelProvider;
  apiKey?: string;
  model: string;
  embeddingModel: string;
  dimensions: number;
  isConfigured(): boolean;
};
export type TemplateType =
  | "extractor"
  | "streaming"
  | "community"
  | "llamapack"
  | "multiagent";
export type TemplateFramework = "nextjs" | "express" | "fastapi";
export type TemplateUI = "html" | "shadcn";
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
export type TemplateObservability = "none" | "traceloop" | "llamatrace";
export type TemplateAgents = "financial_report" | "blog" | "form_filling";
// Config for both file and folder
export type FileSourceConfig =
  | {
      path: string;
    }
  | {
      url: URL;
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

export type CommunityProjectConfig = {
  owner: string;
  repo: string;
  branch: string;
  filePath?: string;
};

export interface InstallTemplateArgs {
  appName: string;
  root: string;
  packageManager: PackageManager;
  isOnline: boolean;
  template: TemplateType;
  framework: TemplateFramework;
  ui: TemplateUI;
  dataSources: TemplateDataSource[];
  customApiPath?: string;
  modelConfig: ModelConfig;
  llamaCloudKey?: string;
  useLlamaParse?: boolean;
  communityProjectConfig?: CommunityProjectConfig;
  llamapack?: string;
  vectorDb?: TemplateVectorDB;
  externalPort?: number;
  postInstallAction?: TemplatePostInstallAction;
  tools?: Tool[];
  observability?: TemplateObservability;
  agents?: TemplateAgents;
}
