import prompts from "prompts";
import { EXAMPLE_10K_SEC_FILES, EXAMPLE_FILE } from "../helpers/datasources";
import { askModelConfig } from "../helpers/providers";
import { getTools } from "../helpers/tools";
import { ModelConfig, TemplateFramework } from "../helpers/types";
import { PureQuestionArgs, QuestionResults } from "./types";
import { askPostInstallAction, questionHandlers } from "./utils";

type AppType =
  | "agentic_rag"
  | "financial_report"
  | "deep_research"
  | "code_generator"
  | "document_generator";

type SimpleAnswers = {
  appType: AppType;
  language: TemplateFramework;
  useLlamaCloud: boolean;
  llamaCloudKey?: string;
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
        {
          title: "Code Generator",
          value: "code_generator",
          description: "Build a Vercel v0 styled code generator.",
        },
        {
          title: "Document Generator",
          value: "document_generator",
          description: "Build a OpenAI canvas-styled document generator.",
        },
      ],
    },
    questionHandlers,
  );

  let language: TemplateFramework = "fastapi";
  let llamaCloudKey = args.llamaCloudKey;

  let useLlamaCloud = false;

  const { language: newLanguage } = await prompts(
    {
      type: "select",
      name: "language",
      message: "What language do you want to use?",
      choices: [
        { title: "Python (FastAPI)", value: "fastapi" },
        { title: "Typescript (NextJS)", value: "nextjs" },
      ],
    },
    questionHandlers,
  );
  language = newLanguage;

  if (appType !== "code_generator" && appType !== "document_generator") {
    const { useLlamaCloud: newUseLlamaCloud } = await prompts(
      {
        type: "toggle",
        name: "useLlamaCloud",
        message: "Do you want to use LlamaCloud services?",
        initial: false,
        active: "Yes",
        inactive: "No",
        hint: "see https://www.llamaindex.ai/enterprise for more info",
      },
      questionHandlers,
    );
    useLlamaCloud = newUseLlamaCloud;
  }

  if (useLlamaCloud && !llamaCloudKey) {
    // Ask for LlamaCloud API key, if not set
    const { llamaCloudKey: newLlamaCloudKey } = await prompts(
      {
        type: "text",
        name: "llamaCloudKey",
        message:
          "Please provide your LlamaCloud API key (leave blank to skip):",
      },
      questionHandlers,
    );
    llamaCloudKey = newLlamaCloudKey || process.env.LLAMA_CLOUD_API_KEY;
  }

  const results = await convertAnswers(args, {
    appType,
    language,
    useLlamaCloud,
    llamaCloudKey,
  });

  results.postInstallAction = await askPostInstallAction(results);
  return results;
};

const convertAnswers = async (
  args: PureQuestionArgs,
  answers: SimpleAnswers,
): Promise<QuestionResults> => {
  const MODEL_GPT41: ModelConfig = {
    provider: "openai",
    apiKey: args.openAiKey,
    model: "gpt-4.1",
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
      modelConfig: MODEL_GPT41,
    },
    deep_research: {
      template: "llamaindexserver",
      dataSources: EXAMPLE_10K_SEC_FILES,
      tools: [],
      modelConfig: MODEL_GPT41,
    },
    code_generator: {
      template: "llamaindexserver",
      dataSources: [],
      tools: [],
      modelConfig: MODEL_GPT41,
    },
    document_generator: {
      template: "llamaindexserver",
      dataSources: [],
      tools: [],
      modelConfig: MODEL_GPT41,
    },
  };

  const results = lookup[answers.appType];
  return {
    framework: answers.language,
    useCase: answers.appType,
    ui: "shadcn",
    llamaCloudKey: answers.llamaCloudKey,
    useLlamaParse: answers.useLlamaCloud,
    vectorDb: answers.useLlamaCloud ? "llamacloud" : "none",
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
