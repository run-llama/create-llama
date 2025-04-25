import { InstallAppArgs } from "../create-app";

export type QuestionResults = Omit<
  InstallAppArgs,
  "appPath" | "packageManager"
>;

export type PureQuestionArgs = {
  askModels?: boolean;
  pro?: boolean;
  openAiKey?: string;
  llamaCloudKey?: string;
};

export type QuestionArgs = QuestionResults & PureQuestionArgs;
