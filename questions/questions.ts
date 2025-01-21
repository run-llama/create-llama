import inquirer, { QuestionCollection } from "inquirer";
import { blue } from "picocolors";
import { isCI } from ".";
import { COMMUNITY_OWNER, COMMUNITY_REPO } from "../helpers/constant";
import { EXAMPLE_FILE, EXAMPLE_GDPR } from "../helpers/datasources";
import { getAvailableLlamapackOptions } from "../helpers/llama-pack";
import { askModelConfig } from "../helpers/providers";
import { getProjectOptions } from "../helpers/repo";
import { supportedTools, toolRequiresConfig } from "../helpers/tools";
import { getDataSourceChoices } from "./datasources";
import { getVectorDbChoices } from "./stores";
import { QuestionArgs } from "./types";
import { askPostInstallAction, selectLocalContextData } from "./utils";

export const askProQuestions = async (program: QuestionArgs) => {
  if (!program.template) {
    const styledRepo = blue(
      `https://github.com/${COMMUNITY_OWNER}/${COMMUNITY_REPO}`,
    );
    const { template } = await inquirer.prompt([
      {
        type: "list",
        name: "template",
        message: "Which template would you like to use?",
        choices: [
          { name: "Agentic RAG (e.g. chat with docs)", value: "streaming" },
          {
            name: "Multi-agent app (using workflows)",
            value: "multiagent",
          },
          { name: "Fullstack python template with Reflex", value: "reflex" },
          {
            name: `Community template from ${styledRepo}`,
            value: "community",
          },
          {
            name: "Example using a LlamaPack",
            value: "llamapack",
          },
        ],
      },
    ]);
    program.template = template;
  }

  if (program.template === "community") {
    const projectOptions = await getProjectOptions(
      COMMUNITY_OWNER,
      COMMUNITY_REPO,
    );
    const { communityProjectConfig } = await inquirer.prompt([
      {
        type: "list",
        name: "communityProjectConfig",
        message: "Select community template",
        choices: projectOptions.map(({ title, value }) => ({
          name: title,
          value: JSON.stringify(value), // serialize value to string in terminal
        })),
      },
    ]);
    const projectConfig = JSON.parse(communityProjectConfig);
    program.communityProjectConfig = projectConfig;
    return; // early return - no further questions needed for community projects
  }

  if (program.template === "llamapack") {
    const availableLlamaPacks = await getAvailableLlamapackOptions();
    const { llamapack } = await inquirer.prompt([
      {
        type: "list",
        name: "llamapack",
        message: "Select LlamaPack",
        choices: availableLlamaPacks.map((pack) => ({
          name: pack.name,
          value: pack.folderPath,
        })),
      },
    ]);
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
    // Ask for which Reflex use case to use
    const { useCase } = await inquirer.prompt([
      {
        type: "list",
        name: "useCase",
        message: "Which use case would you like to build?",
        choices: [
          { name: "Structured Extractor", value: "extractor" },
          {
            name: "Contract review (using Workflow)",
            value: "contract_review",
          },
        ],
      },
    ]);
    program.useCase = useCase;
  }

  if (!program.framework) {
    const choices = [
      { name: "NextJS", value: "nextjs" },
      { name: "Express", value: "express" },
      { name: "FastAPI (Python)", value: "fastapi" },
    ];

    const { framework } = await inquirer.prompt([
      {
        type: "list",
        name: "framework",
        message: "Which framework would you like to use?",
        choices,
      },
    ]);
    program.framework = framework;
  }

  if (
    program.framework === "fastapi" &&
    (program.template === "streaming" || program.template === "multiagent")
  ) {
    // if a backend-only framework is selected, ask whether we should create a frontend
    if (program.frontend === undefined) {
      const styledNextJS = blue("NextJS");
      const { frontend } = await inquirer.prompt([
        {
          type: "confirm",
          name: "frontend",
          message: `Would you like to generate a ${styledNextJS} frontend for your FastAPI backend?`,
          default: false,
        },
      ]);
      program.frontend = frontend;
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
    const { observability } = await inquirer.prompt([
      {
        type: "list",
        name: "observability",
        message: "Would you like to set up observability?",
        choices: [
          { name: "No", value: "none" },
          ...(program.framework === "fastapi"
            ? [{ name: "LlamaTrace", value: "llamatrace" }]
            : []),
          { name: "Traceloop", value: "traceloop" },
        ],
      },
    ]);
    program.observability = observability;
  }

  if (
    (program.template === "reflex" || program.template === "multiagent") &&
    !program.useCase
  ) {
    const choices =
      program.template === "reflex"
        ? [
            { name: "Structured Extractor", value: "extractor" },
            {
              name: "Contract review (using Workflow)",
              value: "contract_review",
            },
          ]
        : [
            {
              name: "Financial report (generate a financial report)",
              value: "financial_report",
            },
            {
              name: "Form filling (fill missing value in a CSV file)",
              value: "form_filling",
            },
            { name: "Blog writer (Write a blog post)", value: "blog" },
          ];

    const { useCase } = await inquirer.prompt([
      {
        type: "list",
        name: "useCase",
        message: "Which use case would you like to use?",
        choices,
      },
    ]);
    program.useCase = useCase;
  }

  // Configure framework and data sources for Reflex template
  if (program.template === "reflex") {
    program.framework = "fastapi";

    program.dataSources =
      program.useCase === "extractor" ? [EXAMPLE_FILE] : [EXAMPLE_GDPR];
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
    const { vectorDb } = await inquirer.prompt([
      {
        type: "list",
        name: "vectorDb",
        message: "Would you like to use a vector database?",
        choices: getVectorDbChoices(program.framework),
      },
    ]);
    program.vectorDb = vectorDb;
  }

  if (program.vectorDb === "llamacloud" && program.dataSources.length === 0) {
    // When using a LlamaCloud index and no data sources are provided, just copy an example file
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
      const { selectedSource } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedSource",
          message: firstQuestion
            ? "Which data source would you like to use?"
            : "Would you like to add another data source?",
          choices,
        },
      ]);

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
          const { baseUrl } = await inquirer.prompt([
            {
              type: "input",
              name: "baseUrl",
              message: "Please provide base URL of the website: ",
              default: "https://www.llamaindex.ai",
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
          ]);

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
          const dbPrompts: QuestionCollection[] = [
            {
              type: "input",
              name: "uri",
              message:
                "Please enter the connection string (URI) for the database.",
              default: "mysql+pymysql://user:pass@localhost:3306/mydb",
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
            {
              type: "input",
              name: "queries",
              message: "Please enter the SQL query to fetch data:",
              default: "SELECT * FROM mytable",
              when: (answers: any) => !!answers.uri,
            },
          ];
          program.dataSources.push({
            type: "db",
            config: await inquirer.prompt(dbPrompts),
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
    // Reflex template doesn't support LlamaParse right now (cannot use asyncio loop in Reflex)
    if (program.useLlamaParse === undefined && program.template !== "reflex") {
      // if already set useLlamaParse, don't ask again
      if (program.dataSources.some((ds) => ds.type === "file")) {
        const { useLlamaParse } = await inquirer.prompt([
          {
            type: "confirm",
            name: "useLlamaParse",
            message:
              "Would you like to use LlamaParse (improved parser for RAG - requires API key)?",
            default: false,
          },
        ]);
        program.useLlamaParse = useLlamaParse;
      }
    }
  }

  // Ask for LlamaCloud API key when using a LlamaCloud index or LlamaParse
  if (isUsingLlamaCloud || program.useLlamaParse) {
    if (!program.llamaCloudKey && !isCI) {
      // if already set, don't ask again
      // Ask for LlamaCloud API key
      const { llamaCloudKey } = await inquirer.prompt([
        {
          type: "input",
          name: "llamaCloudKey",
          message:
            "Please provide your LlamaCloud API key (leave blank to skip):",
        },
      ]);
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
      name: `${tool.display}${toolRequiresConfig(tool) ? " (needs configuration)" : ""}`,
      value: tool.name,
    }));
    const { toolsName } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "toolsName",
        message:
          "Would you like to build an agent using tools? If so, select the tools here, otherwise just press enter",
        choices: toolChoices,
      },
    ]);
    const tools = toolsName?.map((tool: string) =>
      supportedTools.find((t) => t.name === tool),
    );
    program.tools = tools;
  }

  if (!program.postInstallAction) {
    program.postInstallAction = await askPostInstallAction(program);
  }
};
