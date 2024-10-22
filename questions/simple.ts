import prompts from "prompts";
import { getExampleData } from "../helpers/datasources";
import { askModelConfig } from "../helpers/providers";
import { getTools } from "../helpers/tools";
import { ModelConfig, TemplateFramework } from "../helpers/types";
import { PureQuestionArgs, QuestionResults } from "./types";
import { askPostInstallAction, questionHandlers } from "./utils";

type AppType =
  | "rag"
  | "code_artifact"
  | "multiagent"
  | "extractor"
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
  const { appType } = await prompts(
    {
      type: "select",
      name: "appType",
      message: "What app do you want to build?",
      choices: [
        { title: "Agentic RAG", value: "rag" },
        { title: "Data Scientist", value: "data_scientist" },
        { title: "Code Artifact Agent", value: "code_artifact" },
        { title: "Multi-Agent Report Gen", value: "multiagent" },
        { title: "Structured extraction", value: "extractor" },
      ],
    },
    questionHandlers,
  );

  let language: TemplateFramework = "fastapi";
  let llamaCloudKey = args.llamaCloudKey;
  let useLlamaCloud = false;
  if (appType !== "extractor") {
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
    Pick<QuestionResults, "template" | "tools" | "frontend" | "dataSources"> & {
      modelConfig?: ModelConfig;
    }
  > = {
    rag: {
      template: "streaming",
      tools: getTools(["duckduckgo"]),
      frontend: true,
      dataSources: [getExampleData("streaming")],
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
    multiagent: {
      template: "multiagent",
      tools: getTools([
        "document_generator",
        "wikipedia.WikipediaToolSpec",
        "duckduckgo",
        "img_gen",
      ]),
      frontend: true,
      dataSources: [getExampleData("multiagent")],
    },
    extractor: {
      template: "extractor",
      tools: [],
      frontend: false,
      dataSources: [getExampleData("extractor")],
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
