import { EXAMPLE_10K_SEC_FILES, EXAMPLE_FILE } from "../helpers/datasources";
import { getGpt41ModelConfig } from "../helpers/models";
import { ModelConfig, TemplateUseCase } from "../helpers/types";
import { QuestionResults } from "./types";

export const useCaseConfiguration: Record<
  TemplateUseCase,
  Pick<QuestionResults, "template" | "dataSources"> & {
    modelConfig: ModelConfig;
  }
> = {
  agentic_rag: {
    template: "llamaindexserver",
    dataSources: [EXAMPLE_FILE],
    modelConfig: getGpt41ModelConfig(),
  },
  financial_report: {
    template: "llamaindexserver",
    dataSources: EXAMPLE_10K_SEC_FILES,
    modelConfig: getGpt41ModelConfig(),
  },
  deep_research: {
    template: "llamaindexserver",
    dataSources: EXAMPLE_10K_SEC_FILES,
    modelConfig: getGpt41ModelConfig(),
  },
  code_generator: {
    template: "llamaindexserver",
    dataSources: [],
    modelConfig: getGpt41ModelConfig(),
  },
  document_generator: {
    template: "llamaindexserver",
    dataSources: [],
    modelConfig: getGpt41ModelConfig(),
  },
  hitl: {
    template: "llamaindexserver",
    dataSources: [],
    modelConfig: getGpt41ModelConfig(),
  },
};
