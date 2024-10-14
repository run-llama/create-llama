import prompts from "prompts";
import { EXAMPLE_FILE } from "../helpers/datasources";
import { askModelConfig } from "../helpers/providers";
import { getTools } from "../helpers/tools";
import { ModelConfig, TemplateFramework } from "../helpers/types";
import { PureQuestionArgs, QuestionResults } from "./types";
import { askPostInstallAction, questionHandlers } from "./utils";
type AppType = "rag" | "code_artifact" | "multiagent" | "extractor";

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
    Pick<QuestionResults, "template" | "tools" | "frontend" | "dataSources">
  > = {
    rag: {
      template: "streaming",
      tools: getTools(["duckduckgo"]),
      frontend: true,
      dataSources: [EXAMPLE_FILE],
    },
    code_artifact: {
      template: "streaming",
      tools: getTools(["artifact"]),
      frontend: true,
      dataSources: [],
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
      dataSources: [EXAMPLE_FILE],
    },
    extractor: {
      template: "extractor",
      tools: [],
      frontend: false,
      dataSources: [EXAMPLE_FILE],
    },
  };
  const results = lookup[answers.appType];
  return {
    framework: answers.language,
    ui: "shadcn",
    llamaCloudKey: answers.llamaCloudKey,
    useLlamaParse: answers.useLlamaCloud,
    llamapack: "",
    postInstallAction: "none",
    vectorDb: answers.useLlamaCloud ? "llamacloud" : "none",
    modelConfig: answers.modelConfig,
    observability: "none",
    ...results,
    frontend: answers.language === "nextjs" ? false : results.frontend,
  };
};
