import { PackageManager } from "../helpers/get-pkg-manager";
import { Tool } from "./tools";

export type TemplateType = "streaming" | "community" | "llamapack";
export type TemplateFramework = "nextjs" | "express" | "fastapi";
export type TemplateEngine = "simple" | "context";
export type TemplateUI = "html" | "shadcn";
export type TemplateVectorDB = "none" | "mongo" | "pg" | "pinecone" | "milvus";
export type TemplatePostInstallAction =
  | "none"
  | "VSCode"
  | "dependencies"
  | "runApp";
export type TemplateDataSource = {
  type: TemplateDataSourceType;
  config: TemplateDataSourceConfig;
};
export type TemplateDataSourceType = "file" | "web";
export type TemplateObservability = "none" | "opentelemetry";
// Config for both file and folder
export type FileSourceConfig = {
  path?: string;
};
export type WebSourceConfig = {
  baseUrl?: string;
  prefix?: string;
  depth?: number;
};

export type TemplateDataSourceConfig = FileSourceConfig | WebSourceConfig;

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
  engine: TemplateEngine;
  ui: TemplateUI;
  dataSources: TemplateDataSource[];
  eslint: boolean;
  customApiPath?: string;
  openAiKey?: string;
  llamaCloudKey?: string;
  useLlamaParse?: boolean;
  model: string;
  embeddingModel: string;
  communityProjectConfig?: CommunityProjectConfig;
  llamapack?: string;
  vectorDb?: TemplateVectorDB;
  externalPort?: number;
  postInstallAction?: TemplatePostInstallAction;
  tools?: Tool[];
  observability?: TemplateObservability;
}
