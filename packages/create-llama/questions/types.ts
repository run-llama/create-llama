import { InstallAppArgs } from "../create-app";
import {
  TemplateFramework,
  TemplatePostInstallAction,
  TemplateUseCase,
  TemplateVectorDB,
} from "../helpers";

export type QuestionResults = Omit<
  InstallAppArgs,
  "appPath" | "packageManager"
>;

export type QuestionArgs = {
  useCase?: TemplateUseCase;
  framework?: TemplateFramework;
  askModels?: boolean;
  llamaCloudKey?: string;
  port?: number;
  postInstallAction?: TemplatePostInstallAction;
  vectorDb?: TemplateVectorDB;
};
