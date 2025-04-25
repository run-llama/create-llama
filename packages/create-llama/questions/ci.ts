import { askModelConfig } from "../helpers/providers";
import { QuestionArgs, QuestionResults } from "./types";

const defaults: Omit<QuestionArgs, "modelConfig"> = {
  template: "streaming",
  framework: "nextjs",
  ui: "shadcn",
  frontend: false,
  llamaCloudKey: "",
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
    modelConfig: await askModelConfig({
      openAiKey: program.openAiKey,
      askModels: false,
      framework: program.framework,
    }),
  };
}
