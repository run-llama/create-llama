import { blue } from "picocolors";
import prompts from "prompts";
import { isCI } from ".";
import { COMMUNITY_OWNER, COMMUNITY_REPO } from "../helpers/constant";
import { EXAMPLE_FILE } from "../helpers/datasources";
import { getAvailableLlamapackOptions } from "../helpers/llama-pack";
import { askModelConfig } from "../helpers/providers";
import { getProjectOptions } from "../helpers/repo";
import { supportedTools, toolRequiresConfig } from "../helpers/tools";
import { getDataSourceChoices } from "./datasources";
import { getVectorDbChoices } from "./stores";
import { QuestionArgs } from "./types";
import {
  askPostInstallAction,
  onPromptState,
  questionHandlers,
  selectLocalContextData,
} from "./utils";

export const askProQuestions = async (program: QuestionArgs) => {
  if (!program.template) {
    const styledRepo = blue(
      `https://github.com/${COMMUNITY_OWNER}/${COMMUNITY_REPO}`,
    );
    const { template } = await prompts(
      {
        type: "select",
        name: "template",
        message: "Which template would you like to use?",
        choices: [
          { title: "Agentic RAG (e.g. chat with docs)", value: "streaming" },
          {
            title: "Multi-agent app (using workflows)",
            value: "multiagent",
          },
          { title: "Structured Extractor", value: "extractor" },
          {
            title: `Community template from ${styledRepo}`,
            value: "community",
          },
          {
            title: "Example using a LlamaPack",
            value: "llamapack",
          },
        ],
        initial: 0,
      },
      questionHandlers,
    );
    program.template = template;
  }

  if (program.template === "community") {
    const projectOptions = await getProjectOptions(
      COMMUNITY_OWNER,
      COMMUNITY_REPO,
    );
    const { communityProjectConfig } = await prompts(
      {
        type: "select",
        name: "communityProjectConfig",
        message: "Select community template",
        choices: projectOptions.map(({ title, value }) => ({
          title,
          value: JSON.stringify(value), // serialize value to string in terminal
        })),
        initial: 0,
      },
      questionHandlers,
    );
    const projectConfig = JSON.parse(communityProjectConfig);
    program.communityProjectConfig = projectConfig;
    return; // early return - no further questions needed for community projects
  }

  if (program.template === "llamapack") {
    const availableLlamaPacks = await getAvailableLlamapackOptions();
    const { llamapack } = await prompts(
      {
        type: "select",
        name: "llamapack",
        message: "Select LlamaPack",
        choices: availableLlamaPacks.map((pack) => ({
          title: pack.name,
          value: pack.folderPath,
        })),
        initial: 0,
      },
      questionHandlers,
    );
    program.llamapack = llamapack;
    if (!program.postInstallAction) {
      program.postInstallAction = await askPostInstallAction(program);
    }
    return; // early return - no further questions needed for llamapack projects
  }

  if (program.template === "reflex") {
    // Reflex template only supports FastAPI, empty data sources, and llamacloud
    // So we just use example file for extractor template, this allows user to choose vector database later
    program.dataSources = [EXAMPLE_FILE];
    program.framework = "fastapi";
  }

  if (!program.framework) {
    const choices = [
      { title: "NextJS", value: "nextjs" },
      { title: "Express", value: "express" },
      { title: "FastAPI (Python)", value: "fastapi" },
    ];

    const { framework } = await prompts(
      {
        type: "select",
        name: "framework",
        message: "Which framework would you like to use?",
        choices,
        initial: 0,
      },
      questionHandlers,
    );
    program.framework = framework;
  }

  if (
    program.framework === "fastapi" &&
    (program.template === "streaming" || program.template === "multiagent")
  ) {
    // if a backend-only framework is selected, ask whether we should create a frontend
    if (program.frontend === undefined) {
      const styledNextJS = blue("NextJS");
      const { frontend } = await prompts({
        onState: onPromptState,
        type: "toggle",
        name: "frontend",
        message: `Would you like to generate a ${styledNextJS} frontend for your FastAPI backend?`,
        initial: false,
        active: "Yes",
        inactive: "No",
      });
      program.frontend = Boolean(frontend);
    }
  } else {
    program.frontend = false;
  }

  if (program.framework === "nextjs" || program.frontend) {
    if (!program.ui) {
      program.ui = "shadcn";
    }
  }

  if (!program.observability && program.template === "streaming") {
    const { observability } = await prompts(
      {
        type: "select",
        name: "observability",
        message: "Would you like to set up observability?",
        choices: [
          { title: "No", value: "none" },
          ...(program.framework === "fastapi"
            ? [{ title: "LlamaTrace", value: "llamatrace" }]
            : []),
          { title: "Traceloop", value: "traceloop" },
        ],
        initial: 0,
      },
      questionHandlers,
    );

    program.observability = observability;
  }

  // Ask agents
  if (program.template === "multiagent" && !program.agents) {
    const { agents } = await prompts(
      {
        type: "select",
        name: "agents",
        message: "Which agents would you like to use?",
        choices: [
          {
            title: "Financial report (generate a financial report)",
            value: "financial_report",
          },
          {
            title: "Form filling (fill missing value in a CSV file)",
            value: "form_filling",
          },
          {
            title: "Blog writer (Write a blog post)",
            value: "blog_writer",
          },
        ],
        initial: 0,
      },
      questionHandlers,
    );
    program.agents = agents;
  }

  if (!program.modelConfig) {
    const modelConfig = await askModelConfig({
      openAiKey: program.openAiKey,
      askModels: program.askModels ?? false,
      framework: program.framework,
    });
    program.modelConfig = modelConfig;
  }

  if (!program.vectorDb) {
    const { vectorDb } = await prompts(
      {
        type: "select",
        name: "vectorDb",
        message: "Would you like to use a vector database?",
        choices: getVectorDbChoices(program.framework),
        initial: 0,
      },
      questionHandlers,
    );
    program.vectorDb = vectorDb;
  }

  if (program.vectorDb === "llamacloud") {
    // When using a LlamaCloud index, don't ask for data sources just copy an example file
    program.dataSources = [EXAMPLE_FILE];
  }

  if (!program.dataSources) {
    program.dataSources = [];
    // continue asking user for data sources if none are initially provided
    while (true) {
      const firstQuestion = program.dataSources.length === 0;
      const choices = getDataSourceChoices(
        program.framework,
        program.dataSources,
        program.template,
      );
      if (choices.length === 0) break;
      const { selectedSource } = await prompts(
        {
          type: "select",
          name: "selectedSource",
          message: firstQuestion
            ? "Which data source would you like to use?"
            : "Would you like to add another data source?",
          choices,
          initial: firstQuestion ? 1 : 0,
        },
        questionHandlers,
      );

      if (selectedSource === "no" || selectedSource === "none") {
        // user doesn't want another data source or any data source
        break;
      }
      switch (selectedSource) {
        case "exampleFile": {
          program.dataSources.push(EXAMPLE_FILE);
          break;
        }
        case "file":
        case "folder": {
          const selectedPaths = await selectLocalContextData(selectedSource);
          for (const p of selectedPaths) {
            program.dataSources.push({
              type: "file",
              config: {
                path: p,
              },
            });
          }
          break;
        }
        case "web": {
          const { baseUrl } = await prompts(
            {
              type: "text",
              name: "baseUrl",
              message: "Please provide base URL of the website: ",
              initial: "https://www.llamaindex.ai",
              validate: (value: string) => {
                if (!value.includes("://")) {
                  value = `https://${value}`;
                }
                const urlObj = new URL(value);
                if (
                  urlObj.protocol !== "https:" &&
                  urlObj.protocol !== "http:"
                ) {
                  return `URL=${value} has invalid protocol, only allow http or https`;
                }
                return true;
              },
            },
            questionHandlers,
          );

          program.dataSources.push({
            type: "web",
            config: {
              baseUrl,
              prefix: baseUrl,
              depth: 1,
            },
          });
          break;
        }
        case "db": {
          const dbPrompts: prompts.PromptObject<string>[] = [
            {
              type: "text",
              name: "uri",
              message:
                "Please enter the connection string (URI) for the database.",
              initial: "mysql+pymysql://user:pass@localhost:3306/mydb",
              validate: (value: string) => {
                if (!value) {
                  return "Please provide a valid connection string";
                } else if (
                  !(
                    value.startsWith("mysql+pymysql://") ||
                    value.startsWith("postgresql+psycopg://")
                  )
                ) {
                  return "The connection string must start with 'mysql+pymysql://' for MySQL or 'postgresql+psycopg://' for PostgreSQL";
                }
                return true;
              },
            },
            // Only ask for a query, user can provide more complex queries in the config file later
            {
              type: (prev) => (prev ? "text" : null),
              name: "queries",
              message: "Please enter the SQL query to fetch data:",
              initial: "SELECT * FROM mytable",
            },
          ];
          program.dataSources.push({
            type: "db",
            config: await prompts(dbPrompts, questionHandlers),
          });
          break;
        }
      }
    }
  }

  const isUsingLlamaCloud = program.vectorDb === "llamacloud";

  // Asking for LlamaParse if user selected file data source
  if (isUsingLlamaCloud) {
    // default to use LlamaParse if using LlamaCloud
    program.useLlamaParse = true;
  } else {
    // Reflex template doesn't support LlamaParse and LlamaCloud right now (cannot use asyncio loop in Reflex)
    if (program.useLlamaParse === undefined && program.template !== "reflex") {
      // if already set useLlamaParse, don't ask again
      if (program.dataSources.some((ds) => ds.type === "file")) {
        const { useLlamaParse } = await prompts(
          {
            type: "toggle",
            name: "useLlamaParse",
            message:
              "Would you like to use LlamaParse (improved parser for RAG - requires API key)?",
            initial: false,
            active: "Yes",
            inactive: "No",
          },
          questionHandlers,
        );
        program.useLlamaParse = useLlamaParse;
      }
    }
  }

  // Ask for LlamaCloud API key when using a LlamaCloud index or LlamaParse
  if (isUsingLlamaCloud || program.useLlamaParse) {
    if (!program.llamaCloudKey && !isCI) {
      // if already set, don't ask again
      // Ask for LlamaCloud API key
      const { llamaCloudKey } = await prompts(
        {
          type: "text",
          name: "llamaCloudKey",
          message:
            "Please provide your LlamaCloud API key (leave blank to skip):",
        },
        questionHandlers,
      );
      program.llamaCloudKey = llamaCloudKey || process.env.LLAMA_CLOUD_API_KEY;
    }
  }

  if (
    !program.tools &&
    (program.template === "streaming" || program.template === "multiagent")
  ) {
    const options = supportedTools.filter((t) =>
      t.supportedFrameworks?.includes(program.framework),
    );
    const toolChoices = options.map((tool) => ({
      title: `${tool.display}${toolRequiresConfig(tool) ? " (needs configuration)" : ""}`,
      value: tool.name,
    }));
    const { toolsName } = await prompts({
      type: "multiselect",
      name: "toolsName",
      message:
        "Would you like to build an agent using tools? If so, select the tools here, otherwise just press enter",
      choices: toolChoices,
    });
    const tools = toolsName?.map((tool: string) =>
      supportedTools.find((t) => t.name === tool),
    );
    program.tools = tools;
  }

  if (!program.postInstallAction) {
    program.postInstallAction = await askPostInstallAction(program);
  }
};
