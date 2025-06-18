import { EXAMPLE_10K_SEC_FILES, EXAMPLE_FILE } from "../helpers/datasources";
import { getGpt41ModelConfig } from "../helpers/models";
import { ModelConfig } from "../helpers/types";
import { QuestionResults } from "./types";

export type AppType =
  | "agentic_rag"
  | "financial_report"
  | "deep_research"
  | "code_generator"
  | "document_generator"
  | "hitl";

export const useCaseConfiguration: Record<
  AppType,
  Pick<QuestionResults, "template" | "dataSources" | "useCase"> & {
    modelConfig: ModelConfig;
  }
> = {
  agentic_rag: {
    template: "llamaindexserver",
    dataSources: [EXAMPLE_FILE],
    modelConfig: getGpt41ModelConfig(),
    useCase: "agentic_rag",
  },
  financial_report: {
    template: "llamaindexserver",
    dataSources: EXAMPLE_10K_SEC_FILES,
    modelConfig: getGpt41ModelConfig(),
    useCase: "financial_report",
  },
  deep_research: {
    template: "llamaindexserver",
    dataSources: EXAMPLE_10K_SEC_FILES,
    modelConfig: getGpt41ModelConfig(),
    useCase: "deep_research",
  },
  code_generator: {
    template: "llamaindexserver",
    dataSources: [],
    modelConfig: getGpt41ModelConfig(),
    useCase: "code_generator",
  },
  document_generator: {
    template: "llamaindexserver",
    dataSources: [],
    modelConfig: getGpt41ModelConfig(),
    useCase: "document_generator",
  },
  hitl: {
    template: "llamaindexserver",
    dataSources: [],
    modelConfig: getGpt41ModelConfig(),
    useCase: "hitl",
  },
};
