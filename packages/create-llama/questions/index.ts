import prompts from "prompts";
import { askModelConfig } from "../helpers/providers";
import {
  TemplateFramework,
  TemplateUseCase,
  TemplateVectorDB,
} from "../helpers/types";
import { QuestionArgs, QuestionResults } from "./types";
import { useCaseConfiguration } from "./usecases";
import { askPostInstallAction, questionHandlers } from "./utils";

export const askQuestions = async (
  args: QuestionArgs,
): Promise<QuestionResults> => {
  const {
    useCase: useCaseFromArgs,
    framework: frameworkFromArgs,
    llamaCloudKey: llamaCloudKeyFromArgs,
    vectorDb: vectorDbFromArgs,
    postInstallAction: postInstallActionFromArgs,
    askModels: askModelsFromArgs,
  } = args;

  const { useCase } = await prompts(
    [
      {
        type: useCaseFromArgs ? null : "select",
        name: "useCase",
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
        initial: 0,
      },
    ],
    questionHandlers,
  );

  const { framework } = await prompts(
    {
      type: frameworkFromArgs ? null : "select",
      name: "framework",
      message: "What language do you want to use?",
      choices: [
        // For Python Human in the Loop use case, please refer to this chat-ui example:
        // https://github.com/run-llama/chat-ui/blob/main/examples/llamadeploy/chat/src/cli_workflow.py
        ...(useCase !== "hitl"
          ? [{ title: "Python (FastAPI)", value: "fastapi" }]
          : []),
        { title: "Typescript (NextJS)", value: "nextjs" },
      ],
      initial: 0,
    },
    questionHandlers,
  );

  const finalUseCase = (useCaseFromArgs ?? useCase) as TemplateUseCase;
  const finalFramework = (frameworkFromArgs ?? framework) as TemplateFramework;
  if (!finalUseCase) {
    throw new Error("Use case is required");
  }
  if (!finalFramework) {
    throw new Error("Framework is required");
  }

  // lookup configuration for the use case
  const useCaseConfig = useCaseConfiguration[finalUseCase];

  // Ask for model provider
  let modelConfig = useCaseConfig.modelConfig;
  if (askModelsFromArgs) {
    modelConfig = await askModelConfig({
      framework: finalFramework,
    });
  }

  // Ask for LlamaCloud
  let llamaCloudKey = llamaCloudKeyFromArgs ?? process.env.LLAMA_CLOUD_API_KEY;
  let vectorDb: TemplateVectorDB = vectorDbFromArgs ?? "none";

  if (
    !vectorDbFromArgs &&
    useCaseConfig.dataSources &&
    !["code_generator", "document_generator", "hitl"].includes(finalUseCase) // these use cases don't use data so no need to ask for LlamaCloud
  ) {
    const { useLlamaCloud } = await prompts(
      {
        type: "toggle",
        name: "useLlamaCloud",
        message: "Do you want to use LlamaCloud?",
        active: "Yes",
        inactive: "No",
        initial: false,
      },
      questionHandlers,
    );
    if (useLlamaCloud && !llamaCloudKey) {
      const { llamaCloudKey: llamaCloudKeyFromPrompt } = await prompts(
        {
          type: "text",
          name: "llamaCloudKey",
          message:
            "Please provide your LlamaCloud API key (leave blank to skip):",
        },
        questionHandlers,
      );
      llamaCloudKey = llamaCloudKeyFromPrompt;
    }
    vectorDb = useLlamaCloud ? "llamacloud" : "none";
  }

  const result = {
    ...useCaseConfig,
    framework: finalFramework,
    useCase: finalUseCase,
    modelConfig,
    llamaCloudKey,
    useLlamaParse: vectorDb === "llamacloud",
    vectorDb,
  };

  const postInstallAction =
    postInstallActionFromArgs ?? (await askPostInstallAction(result));

  return {
    ...result,
    postInstallAction,
  };
};
