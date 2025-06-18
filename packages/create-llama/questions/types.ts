import { InstallAppArgs } from "../create-app";

export type QuestionResults = Omit<
  InstallAppArgs,
  "appPath" | "packageManager" | "observability"
>;

export type PureQuestionArgs = {
  askModels?: boolean;
  openAiKey?: string;
  llamaCloudKey?: string;
};

export type QuestionArgs = QuestionResults & PureQuestionArgs;
