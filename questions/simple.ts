import prompts from "prompts";
import { askModelConfig } from "../helpers/providers";
import { getTools } from "../helpers/tools";
import { ModelConfig, TemplateFramework } from "../helpers/types";
import { PureQuestionArgs, QuestionResults } from "./types";
import { askPostInstallAction, questionHandlers } from "./utils";
type AppType = "rag" | "code_artifact" | "multiagent" | "extractor";

// TODO: configure data sources

type SimpleAnswers = {
  appType: AppType;
  language: TemplateFramework;
  useLlamaCloud: boolean;
  llamaCloudKey?: string;
  modelConfig: ModelConfig;
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
        { title: "Code Artifact Agent", value: "code_artifact" },
        { title: "Multi-Agent Report Gen", value: "multiagent" },
        { title: "Structured extraction", value: "extractor" },
      ],
    },
    questionHandlers,
  );

  let language: TemplateFramework = "fastapi";
  if (appType !== "extractor") {
    const res = await prompts(
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
    language = res.language;
  }

  const { useLlamaCloud } = await prompts(
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

  let llamaCloudKey = args.llamaCloudKey;
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

  const modelConfig = await askModelConfig({
    openAiKey: args.openAiKey,
    askModels: args.askModels ?? false,
    framework: language,
  });

  const results = convertAnswers({
    appType,
    language,
    useLlamaCloud,
    llamaCloudKey,
    modelConfig,
  });

  results.postInstallAction = await askPostInstallAction(results);
  return results;
};

const convertAnswers = (answers: SimpleAnswers): QuestionResults => {
  const lookup: Record<
    AppType,
    Pick<QuestionResults, "template" | "tools" | "frontend">
  > = {
    rag: {
      template: "streaming",
      tools: getTools(["duckduckgo"]),
      frontend: true,
    },
    code_artifact: {
      template: "streaming",
      tools: getTools(["artifact"]),
      frontend: true,
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
    },
    extractor: { template: "extractor", tools: [], frontend: false },
  };
  const results = lookup[answers.appType];
  return {
    framework: answers.language,
    ui: "shadcn",
    llamaCloudKey: answers.llamaCloudKey,
    useLlamaParse: answers.useLlamaCloud,
    llamapack: "",
    postInstallAction: "none",
    dataSources: [],
    vectorDb: answers.useLlamaCloud ? "llamacloud" : "none",
    modelConfig: answers.modelConfig,
    observability: "none",
    ...results,
    frontend: answers.language === "nextjs" ? false : results.frontend,
  };
};
