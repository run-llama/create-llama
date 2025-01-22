import inquirer from "inquirer";
import {
  EXAMPLE_10K_SEC_FILES,
  EXAMPLE_FILE,
  EXAMPLE_GDPR,
} from "../helpers/datasources";
import { askModelConfig } from "../helpers/providers";
import { getTools } from "../helpers/tools";
import { ModelConfig, TemplateFramework } from "../helpers/types";
import { PureQuestionArgs, QuestionResults } from "./types";
import { askPostInstallAction } from "./utils";

type AppType =
  | "rag"
  | "code_artifact"
  | "financial_report_agent"
  | "form_filling"
  | "extractor"
  | "contract_review"
  | "data_scientist";

type SimpleAnswers = {
  appType: AppType;
  language: TemplateFramework;
  useLlamaCloud: boolean;
  llamaCloudKey?: string;
};

export const askSimpleQuestions = async (
  args: PureQuestionArgs,
): Promise<QuestionResults> => {
  const { appType } = await inquirer.prompt([
    {
      type: "list",
      name: "appType",
      message: "What app do you want to build?",
      pageSize: Infinity,
      choices: [
        new inquirer.Separator("Agents"),
        { name: " Agentic RAG", value: "rag" },
        { name: " Data Scientist", value: "data_scientist" },
        { name: " Code Artifact Agent", value: "code_artifact" },
        { name: " Information Extractor", value: "extractor" },
        new inquirer.Separator("Agentic Document Workflows"),
        {
          name: " Financial Report Generator",
          value: "financial_report_agent",
        },
        {
          name: " Financial 10k SEC Form Filler",
          value: "form_filling",
        },
        {
          name: " Contract Review",
          value: "contract_review",
        },
      ],
    },
  ]);

  let language: TemplateFramework = "fastapi";
  let llamaCloudKey = args.llamaCloudKey;
  let useLlamaCloud = false;

  if (appType !== "extractor" && appType !== "contract_review") {
    const { language: newLanguage } = await inquirer.prompt([
      {
        type: "list",
        name: "language",
        message: "What language do you want to use?",
        choices: [
          { name: "Python (FastAPI)", value: "fastapi" },
          { name: "Typescript (NextJS)", value: "nextjs" },
        ],
      },
    ]);
    language = newLanguage;
  }

  const { useLlamaCloud: newUseLlamaCloud } = await inquirer.prompt([
    {
      type: "confirm",
      name: "useLlamaCloud",
      message: "Do you want to use LlamaCloud services?",
      suffix: " (see https://www.llamaindex.ai/enterprise for more info)",
      default: false,
    },
  ]);
  useLlamaCloud = newUseLlamaCloud;

  if (useLlamaCloud && !llamaCloudKey) {
    // Ask for LlamaCloud API key, if not set
    const { llamaCloudKey: newLlamaCloudKey } = await inquirer.prompt([
      {
        type: "input",
        name: "llamaCloudKey",
        message:
          "Please provide your LlamaCloud API key (leave blank to skip):",
      },
    ]);
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
    Pick<
      QuestionResults,
      "template" | "tools" | "frontend" | "dataSources" | "useCase"
    > & {
      modelConfig?: ModelConfig;
    }
  > = {
    rag: {
      template: "streaming",
      tools: getTools(["weather"]),
      frontend: true,
      dataSources: [EXAMPLE_FILE],
    },
    data_scientist: {
      template: "streaming",
      tools: getTools(["interpreter", "document_generator"]),
      frontend: true,
      dataSources: [],
      modelConfig: MODEL_GPT4o,
    },
    code_artifact: {
      template: "streaming",
      tools: getTools(["artifact"]),
      frontend: true,
      dataSources: [],
      modelConfig: MODEL_GPT4o,
    },
    financial_report_agent: {
      template: "multiagent",
      useCase: "financial_report",
      tools: getTools(["document_generator", "interpreter"]),
      dataSources: EXAMPLE_10K_SEC_FILES,
      frontend: true,
      modelConfig: MODEL_GPT4o,
    },
    form_filling: {
      template: "multiagent",
      useCase: "form_filling",
      tools: getTools(["form_filling"]),
      dataSources: EXAMPLE_10K_SEC_FILES,
      frontend: true,
      modelConfig: MODEL_GPT4o,
    },
    extractor: {
      template: "reflex",
      useCase: "extractor",
      tools: [],
      frontend: false,
      dataSources: [EXAMPLE_FILE],
    },
    contract_review: {
      template: "reflex",
      useCase: "contract_review",
      tools: [],
      frontend: false,
      dataSources: [EXAMPLE_GDPR],
    },
  };
  const results = lookup[answers.appType];
  return {
    framework: answers.language,
    ui: "shadcn",
    llamaCloudKey: answers.llamaCloudKey,
    useLlamaParse: answers.useLlamaCloud,
    llamapack: "",
    vectorDb: answers.useLlamaCloud ? "llamacloud" : "none",
    observability: "none",
    ...results,
    modelConfig:
      results.modelConfig ??
      (await askModelConfig({
        openAiKey: args.openAiKey,
        askModels: args.askModels ?? false,
        framework: answers.language,
      })),
    frontend: answers.language === "nextjs" ? false : results.frontend,
  };
};
