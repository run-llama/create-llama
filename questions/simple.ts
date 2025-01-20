import prompts from "prompts";
import {
  AI_REPORTS,
  EXAMPLE_10K_SEC_FILES,
  EXAMPLE_FILE,
  EXAMPLE_GDPR,
} from "../helpers/datasources";
import { askModelConfig } from "../helpers/providers";
import { getTools } from "../helpers/tools";
import { ModelConfig, TemplateFramework } from "../helpers/types";
import { PureQuestionArgs, QuestionResults } from "./types";
import { askPostInstallAction, questionHandlers } from "./utils";

type AppType =
  | "rag"
  | "code_artifact"
  | "financial_report_agent"
  | "form_filling"
  | "extractor"
  | "contract_review"
  | "data_scientist"
  | "blog";

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
      message: "What app do you want to build?",
      hint: "🤖: Agent, 🔀: Workflow",
      choices: [
        {
          title: "🤖 Agentic RAG",
          value: "rag",
          description:
            "Build a chatbot that can answer questions based on provided documents.",
        },
        {
          title: "🤖 Data Scientist",
          value: "data_scientist",
          description:
            "An data scientist agent that can analyze data and generate visualizations by using a code interpreter.",
        },
        {
          title: "🤖 Code Artifact Agent",
          value: "code_artifact",
          description:
            "An agent that can write code, run it in a sandboxed environment, and finally show the output in the chat UI.",
        },
        {
          title: "🤖 Information Extractor",
          value: "extractor",
          description:
            "Extract information from provided documents and return it as a structured JSON object by defining a Pydantic model.",
        },
        {
          title: "🔀 Financial Report Generator",
          value: "financial_report_agent",
          description:
            "Generate a financial report by analyzing the provided 10-K SEC data and use a code interpreter to create charts or conduct further analysis.",
        },
        {
          title: "🔀 Financial 10k SEC Form Filler",
          value: "form_filling",
          description:
            "Extract information from 10k SEC data and use it to fill out a CSV form template.",
        },
        {
          title: "🔀 Contract Review",
          value: "contract_review",
          description:
            "Extract and review contracts to ensure compliance with regulations (GDPR)",
        },
        {
          title: "🔀 Blog Writer",
          value: "blog",
          description:
            "Write a blog post by analyzing the provided data from different perspectives and crafting a coherent blog post with citations to the data.",
        },
      ],
    },
    questionHandlers,
  );

  let language: TemplateFramework = "fastapi";
  let llamaCloudKey = args.llamaCloudKey;
  let useLlamaCloud = false;

  if (
    appType !== "extractor" &&
    appType !== "contract_review" &&
    appType !== "blog"
  ) {
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
  }

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
    blog: {
      template: "multiagent",
      useCase: "blog",
      tools: [],
      frontend: true,
      dataSources: [AI_REPORTS],
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
