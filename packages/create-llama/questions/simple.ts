import prompts from "prompts";
import { askModelConfig } from "../helpers/providers";
import { TemplateFramework, TemplateVectorDB } from "../helpers/types";
import { PureQuestionArgs, QuestionResults } from "./types";
import { AppType, useCaseConfiguration } from "./usecases";
import { askPostInstallAction, questionHandlers } from "./utils";

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
        {
          title: "Human in the Loop",
          value: "hitl",
          description:
            "Build a CLI command workflow that is reviewed by a human before execution",
        },
      ],
    },
    questionHandlers,
  );

  let language: TemplateFramework = "fastapi";

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

  const results = await convertAnswers(args, {
    appType,
    language,
  });

  let llamaCloudKey = args.llamaCloudKey;
  let useLlamaCloud = false;
  if (results.dataSources.length > 0) {
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

  const resultsWithLlamaCloud = {
    ...results,
    llamaCloudKey,
    useLlamaParse: useLlamaCloud,
    vectorDb: (useLlamaCloud ? "llamacloud" : "none") as TemplateVectorDB,
  };

  return {
    ...resultsWithLlamaCloud,
    postInstallAction: await askPostInstallAction(resultsWithLlamaCloud),
  };
};

const convertAnswers = async (
  args: PureQuestionArgs,
  answers: SimpleAnswers,
): Promise<
  Omit<QuestionResults, "postInstallAction" | "useLlamaParse" | "vectorDb">
> => {
  const results = useCaseConfiguration[answers.appType];

  let modelConfig = results.modelConfig;
  if (args.askModels) {
    modelConfig = await askModelConfig({
      framework: answers.language,
    });
  }

  return {
    framework: answers.language,
    ...results,
    modelConfig,
  };
};
