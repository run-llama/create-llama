import { InstallAppArgs } from "../create-app";

export type QuestionResults = Omit<
  InstallAppArgs,
  "appPath" | "packageManager" | "externalPort"
>;

export type PureQuestionArgs = {
  askModels?: boolean;
  askExamples?: boolean;
  pro?: boolean;
  openAiKey?: string;
};

export type QuestionArgs = QuestionResults & PureQuestionArgs;
