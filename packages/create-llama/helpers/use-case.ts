import { Dependency, EnvVar, TemplateUseCase } from "./types";

export const USE_CASE_CONFIGS: Record<
  TemplateUseCase,
  {
    starterQuestions: string[];
    additionalEnvVars?: EnvVar[];
    additionalDependencies?: Dependency[];
  }
> = {
  agentic_rag: {
    starterQuestions: [
      "Letter standard in the document",
      "Summarize the document",
    ],
  },
  financial_report: {
    starterQuestions: [
      "Compare Apple and Tesla financial performance",
      "Generate a PDF report for Tesla financial",
    ],
    additionalEnvVars: [
      {
        name: "E2B_API_KEY",
        description: "The E2B API key to use to use code interpreter tool",
      },
    ],
    additionalDependencies: [
      {
        name: "e2b-code-interpreter",
        version: ">=1.1.1,<2.0.0",
      },
      {
        name: "markdown",
        version: ">=3.7,<4.0",
      },
      {
        name: "xhtml2pdf",
        version: ">=0.2.17,<1.0.0",
      },
    ],
  },
  deep_research: {
    starterQuestions: [
      "Research about Apple and Tesla",
      "Financial performance of Tesla",
    ],
  },
  code_generator: {
    starterQuestions: [
      "Generate a code for a simple calculator",
      "Generate a code for a todo list app",
    ],
  },
  document_generator: {
    starterQuestions: [
      "Generate a document about LlamaIndex",
      "Generate a document about LLM",
    ],
  },
  hitl: {
    starterQuestions: [
      "List all the files in the current directory",
      "Check git status",
    ],
  },
};
