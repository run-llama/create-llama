import { getGpt41ModelConfig } from "../helpers/models";
import { QuestionArgs, QuestionResults } from "./types";

const defaults: Omit<QuestionArgs, "modelConfig"> = {
  template: "streaming",
  framework: "nextjs",
  ui: "shadcn",
  frontend: false,
  llamaCloudKey: undefined,
  useLlamaParse: false,
  communityProjectConfig: undefined,
  llamapack: "",
  postInstallAction: "dependencies",
  dataSources: [],
  tools: [],
};

export async function getCIQuestionResults(
  program: QuestionArgs,
): Promise<QuestionResults> {
  return {
    ...defaults,
    ...program,
    modelConfig: getGpt41ModelConfig(program.openAiKey),
  };
}
