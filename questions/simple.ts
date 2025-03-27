import prompts from "prompts";
import { EXAMPLE_10K_SEC_FILES, EXAMPLE_FILE } from "../helpers/datasources";
import { askModelConfig } from "../helpers/providers";
import { getTools } from "../helpers/tools";
import { ModelConfig, TemplateFramework } from "../helpers/types";
import { PureQuestionArgs, QuestionResults } from "./types";
import { askPostInstallAction, questionHandlers } from "./utils";

type AppType = "agentic_rag" | "financial_report" | "deep_research";

type SimpleAnswers = {
  appType: AppType;
  language: TemplateFramework;
};

export const askSimpleQuestions = async (
  args: PureQuestionArgs,
): Promise<QuestionResults> => {
  const { appType } = await prompts(
    {
      type: "select",
      name: "appType",
      message: "What use case do you want to build?",
      choices: [
        {
          title: "Agentic RAG",
          value: "agentic_rag",
          description:
            "Chatbot that answers questions based on provided documents.",
        },
        {
          title: "Financial Report",
          value: "financial_report",
          description:
            "Agent that analyzes data and generates visualizations by using a code interpreter.",
        },
        {
          title: "Deep Research",
          value: "deep_research",
          description:
            "Researches and analyzes provided documents from multiple perspectives, generating a comprehensive report with citations to support key findings and insights.",
        },
      ],
    },
    questionHandlers,
  );

  let language: TemplateFramework = "fastapi";

  const results = await convertAnswers(args, {
    appType,
    language,
  });

  results.postInstallAction = await askPostInstallAction(results);
  return results;
};

const convertAnswers = async (
  args: PureQuestionArgs,
  answers: SimpleAnswers,
): Promise<QuestionResults> => {
  const MODEL_GPT4o: ModelConfig = {
    provider: "openai",
    apiKey: args.openAiKey,
    model: "gpt-4o",
    embeddingModel: "text-embedding-3-large",
    dimensions: 1536,
    isConfigured(): boolean {
      return !!args.openAiKey;
    },
  };
  const lookup: Record<
    AppType,
    Pick<QuestionResults, "template" | "tools" | "dataSources" | "useCase"> & {
      modelConfig?: ModelConfig;
    }
  > = {
    agentic_rag: {
      template: "llamaindexserver",
      dataSources: [EXAMPLE_FILE],
    },
    financial_report: {
      template: "llamaindexserver",
      dataSources: EXAMPLE_10K_SEC_FILES,
      tools: getTools(["interpreter", "document_generator"]),
      modelConfig: MODEL_GPT4o,
    },
    deep_research: {
      template: "llamaindexserver",
      dataSources: EXAMPLE_10K_SEC_FILES,
      tools: [],
      modelConfig: MODEL_GPT4o,
    },
  };

  const results = lookup[answers.appType];
  return {
    framework: answers.language,
    useCase: answers.appType,
    ui: "shadcn",
    ...results,
    modelConfig:
      results.modelConfig ??
      (await askModelConfig({
        openAiKey: args.openAiKey,
        askModels: args.askModels ?? false,
        framework: answers.language,
      })),
    frontend: true,
  };
};
