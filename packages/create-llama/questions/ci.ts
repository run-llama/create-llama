import { getGpt41ModelConfig } from "../helpers/models";
import { QuestionArgs, QuestionResults } from "./types";

const defaults: Omit<QuestionArgs, "modelConfig"> = {
  template: "llamaindexserver",
  framework: "nextjs",
  llamaCloudKey: undefined,
  useLlamaParse: false,
  postInstallAction: "dependencies",
  dataSources: [],
  vectorDb: "none",
  useCase: "agentic_rag",
};

export async function getCIQuestionResults(
  program: QuestionArgs,
): Promise<QuestionResults> {
  return {
    ...defaults,
    ...program,
    modelConfig: getGpt41ModelConfig(),
  };
}
