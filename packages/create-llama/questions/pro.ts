import { QuestionArgs, QuestionResults } from "./types";
import { useCaseConfiguration } from "./usecases";

const defaults: Omit<
  QuestionArgs,
  "modelConfig" | "dataSources" | "useCase" | "template"
> = {
  framework: "nextjs",
  llamaCloudKey: undefined,
  useLlamaParse: false,
  postInstallAction: "dependencies",
  vectorDb: "none",
};

export async function getProQuestionResults(
  program: QuestionArgs,
): Promise<QuestionResults> {
  const { useCase } = program;
  const config = useCase ? useCaseConfiguration[useCase] : undefined;

  return {
    ...defaults,
    ...config,
    ...program,
  };
}
