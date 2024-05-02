import { execSync } from "child_process";
import ciInfo from "ci-info";
import fs from "fs";
import path from "path";
import { blue, green, red } from "picocolors";
import prompts from "prompts";
import { InstallAppArgs } from "./create-app";
import {
  TemplateDataSource,
  TemplateDataSourceType,
  TemplateFramework,
} from "./helpers";
import { COMMUNITY_OWNER, COMMUNITY_REPO } from "./helpers/constant";
import { EXAMPLE_FILE } from "./helpers/datasources";
import { templatesDir } from "./helpers/dir";
import { getAvailableLlamapackOptions } from "./helpers/llama-pack";
import { askModelConfig } from "./helpers/providers";
import { getProjectOptions } from "./helpers/repo";
import { supportedTools, toolsRequireConfig } from "./helpers/tools";

export type QuestionArgs = Omit<
  InstallAppArgs,
  "appPath" | "packageManager"
> & {
  askModels?: boolean;
};
const supportedContextFileTypes = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
];
const MACOS_FILE_SELECTION_SCRIPT = `
osascript -l JavaScript -e '
  a = Application.currentApplication();
  a.includeStandardAdditions = true;
  a.chooseFile({ withPrompt: "Please select files to process:", multipleSelectionsAllowed: true }).map(file => file.toString())
'`;
const MACOS_FOLDER_SELECTION_SCRIPT = `
osascript -l JavaScript -e '
  a = Application.currentApplication();
  a.includeStandardAdditions = true;
  a.chooseFolder({ withPrompt: "Please select folders to process:", multipleSelectionsAllowed: true }).map(folder => folder.toString())
'`;
const WINDOWS_FILE_SELECTION_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
$openFileDialog = New-Object System.Windows.Forms.OpenFileDialog
$openFileDialog.InitialDirectory = [Environment]::GetFolderPath('Desktop')
$openFileDialog.Multiselect = $true
$result = $openFileDialog.ShowDialog()
if ($result -eq 'OK') {
  $openFileDialog.FileNames
}
`;
const WINDOWS_FOLDER_SELECTION_SCRIPT = `
Add-Type -AssemblyName System.windows.forms
$folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
$dialogResult = $folderBrowser.ShowDialog()
if ($dialogResult -eq [System.Windows.Forms.DialogResult]::OK)
{
    $folderBrowser.SelectedPath
}
`;

const defaults: Omit<QuestionArgs, "modelConfig"> = {
  template: "streaming",
  framework: "nextjs",
  ui: "shadcn",
  frontend: false,
  llamaCloudKey: "",
  useLlamaParse: false,
  communityProjectConfig: undefined,
  llamapack: "",
  postInstallAction: "dependencies",
  dataSources: [],
  tools: [],
};

export const questionHandlers = {
  onCancel: () => {
    console.error("Exiting.");
    process.exit(1);
  },
};

const getVectorDbChoices = (framework: TemplateFramework) => {
  const choices = [
    {
      title: "No, just store the data in the file system",
      value: "none",
    },
    { title: "MongoDB", value: "mongo" },
    { title: "PostgreSQL", value: "pg" },
    { title: "Pinecone", value: "pinecone" },
    { title: "Milvus", value: "milvus" },
    { title: "Astra", value: "astra" },
    { title: "Qdrant", value: "qdrant" },
  ];

  const vectordbLang = framework === "fastapi" ? "python" : "typescript";
  const compPath = path.join(templatesDir, "components");
  const vectordbPath = path.join(compPath, "vectordbs", vectordbLang);

  const availableChoices = fs
    .readdirSync(vectordbPath)
    .filter((file) => fs.statSync(path.join(vectordbPath, file)).isDirectory());

  const displayedChoices = choices.filter((choice) =>
    availableChoices.includes(choice.value),
  );

  return displayedChoices;
};

export const getDataSourceChoices = (
  framework: TemplateFramework,
  selectedDataSource: TemplateDataSource[],
) => {
  const choices = [];
  if (selectedDataSource.length > 0) {
    choices.push({
      title: "No",
      value: "no",
    });
  }
  if (selectedDataSource === undefined || selectedDataSource.length === 0) {
    choices.push({
      title: "No data, just a simple chat or agent",
      value: "none",
    });
    choices.push({
      title: "Use an example PDF",
      value: "exampleFile",
    });
  }

  choices.push(
    {
      title: `Use local files (${supportedContextFileTypes.join(", ")})`,
      value: "file",
    },
    {
      title:
        process.platform === "win32"
          ? "Use a local folder"
          : "Use local folders",
      value: "folder",
    },
  );

  if (framework === "fastapi") {
    choices.push({
      title: "Use website content (requires Chrome)",
      value: "web",
    });
    choices.push({
      title: "Use data from a database (Mysql, PostgreSQL)",
      value: "db",
    });
  }
  return choices;
};

const selectLocalContextData = async (type: TemplateDataSourceType) => {
  try {
    let selectedPath: string = "";
    let execScript: string;
    let execOpts: any = {};
    switch (process.platform) {
      case "win32": // Windows
        execScript =
          type === "file"
            ? WINDOWS_FILE_SELECTION_SCRIPT
            : WINDOWS_FOLDER_SELECTION_SCRIPT;
        execOpts = { shell: "powershell.exe" };
        break;
      case "darwin": // MacOS
        execScript =
          type === "file"
            ? MACOS_FILE_SELECTION_SCRIPT
            : MACOS_FOLDER_SELECTION_SCRIPT;
        break;
      default: // Unsupported OS
        console.log(red("Unsupported OS error!"));
        process.exit(1);
    }
    selectedPath = execSync(execScript, execOpts).toString().trim();
    const paths =
      process.platform === "win32"
        ? selectedPath.split("\r\n")
        : selectedPath.split(", ");

    for (const p of paths) {
      if (
        fs.statSync(p).isFile() &&
        !supportedContextFileTypes.includes(path.extname(p))
      ) {
        console.log(
          red(
            `Please select a supported file type: ${supportedContextFileTypes}`,
          ),
        );
        process.exit(1);
      }
    }
    return paths;
  } catch (error) {
    console.log(
      red(
        "Got an error when trying to select local context data! Please try again or select another data source option.",
      ),
    );
    process.exit(1);
  }
};

export const onPromptState = (state: any) => {
  if (state.aborted) {
    // If we don't re-enable the terminal cursor before exiting
    // the program, the cursor will remain hidden
    process.stdout.write("\x1B[?25h");
    process.stdout.write("\n");
    process.exit(1);
  }
};

export const askQuestions = async (
  program: QuestionArgs,
  preferences: QuestionArgs,
  openAiKey?: string,
) => {
  const getPrefOrDefault = <K extends keyof Omit<QuestionArgs, "modelConfig">>(
    field: K,
  ): Omit<QuestionArgs, "modelConfig">[K] =>
    preferences[field] ?? defaults[field];

  // Ask for next action after installation
  async function askPostInstallAction() {
    if (program.postInstallAction === undefined) {
      if (ciInfo.isCI) {
        program.postInstallAction = getPrefOrDefault("postInstallAction");
      } else {
        const actionChoices = [
          {
            title: "Just generate code (~1 sec)",
            value: "none",
          },
          {
            title: "Start in VSCode (~1 sec)",
            value: "VSCode",
          },
          {
            title: "Generate code and install dependencies (~2 min)",
            value: "dependencies",
          },
        ];

        const modelConfigured =
          !program.llamapack && program.modelConfig.isConfigured();
        // If using LlamaParse, require LlamaCloud API key
        const llamaCloudKeyConfigured = program.useLlamaParse
          ? program.llamaCloudKey || process.env["LLAMA_CLOUD_API_KEY"]
          : true;
        const hasVectorDb = program.vectorDb && program.vectorDb !== "none";
        // Can run the app if all tools do not require configuration
        if (
          !hasVectorDb &&
          modelConfigured &&
          llamaCloudKeyConfigured &&
          !toolsRequireConfig(program.tools)
        ) {
          actionChoices.push({
            title:
              "Generate code, install dependencies, and run the app (~2 min)",
            value: "runApp",
          });
        }

        const { action } = await prompts(
          {
            type: "select",
            name: "action",
            message: "How would you like to proceed?",
            choices: actionChoices,
            initial: 1,
          },
          questionHandlers,
        );

        program.postInstallAction = action;
      }
    }
  }

  if (!program.template) {
    if (ciInfo.isCI) {
      program.template = getPrefOrDefault("template");
    } else {
      const styledRepo = blue(
        `https://github.com/${COMMUNITY_OWNER}/${COMMUNITY_REPO}`,
      );
      const { template } = await prompts(
        {
          type: "select",
          name: "template",
          message: "Which template would you like to use?",
          choices: [
            { title: "Chat", value: "streaming" },
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
      preferences.template = template;
    }
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
    preferences.communityProjectConfig = projectConfig;
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
    preferences.llamapack = llamapack;
    await askPostInstallAction();
    return; // early return - no further questions needed for llamapack projects
  }

  if (!program.framework) {
    if (ciInfo.isCI) {
      program.framework = getPrefOrDefault("framework");
    } else {
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
      preferences.framework = framework;
    }
  }

  if (program.framework === "express" || program.framework === "fastapi") {
    // if a backend-only framework is selected, ask whether we should create a frontend
    if (program.frontend === undefined) {
      if (ciInfo.isCI) {
        program.frontend = getPrefOrDefault("frontend");
      } else {
        const styledNextJS = blue("NextJS");
        const styledBackend = green(
          program.framework === "express"
            ? "Express "
            : program.framework === "fastapi"
              ? "FastAPI (Python) "
              : "",
        );
        const { frontend } = await prompts({
          onState: onPromptState,
          type: "toggle",
          name: "frontend",
          message: `Would you like to generate a ${styledNextJS} frontend for your ${styledBackend}backend?`,
          initial: getPrefOrDefault("frontend"),
          active: "Yes",
          inactive: "No",
        });
        program.frontend = Boolean(frontend);
        preferences.frontend = Boolean(frontend);
      }
    }
  } else {
    program.frontend = false;
  }

  if (program.framework === "nextjs" || program.frontend) {
    if (!program.ui) {
      program.ui = defaults.ui;
    }
  }

  if (!program.observability) {
    if (ciInfo.isCI) {
      program.observability = getPrefOrDefault("observability");
    } else {
      const { observability } = await prompts(
        {
          type: "select",
          name: "observability",
          message: "Would you like to set up observability?",
          choices: [
            { title: "No", value: "none" },
            { title: "OpenTelemetry", value: "opentelemetry" },
          ],
          initial: 0,
        },
        questionHandlers,
      );

      program.observability = observability;
      preferences.observability = observability;
    }
  }

  if (!program.modelConfig) {
    const modelConfig = await askModelConfig({
      openAiKey,
      askModels: program.askModels ?? false,
    });
    program.modelConfig = modelConfig;
    preferences.modelConfig = modelConfig;
  }

  if (!program.dataSources) {
    if (ciInfo.isCI) {
      program.dataSources = getPrefOrDefault("dataSources");
    } else {
      program.dataSources = [];
      // continue asking user for data sources if none are initially provided
      while (true) {
        const firstQuestion = program.dataSources.length === 0;
        const { selectedSource } = await prompts(
          {
            type: "select",
            name: "selectedSource",
            message: firstQuestion
              ? "Which data source would you like to use?"
              : "Would you like to add another data source?",
            choices: getDataSourceChoices(
              program.framework,
              program.dataSources,
            ),
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
          }
        }
      }
    }
  }

  // Asking for LlamaParse if user selected file or folder data source
  if (
    program.dataSources.some((ds) => ds.type === "file") &&
    program.useLlamaParse === undefined
  ) {
    if (ciInfo.isCI) {
      program.useLlamaParse = getPrefOrDefault("useLlamaParse");
      program.llamaCloudKey = getPrefOrDefault("llamaCloudKey");
    } else {
      const { useLlamaParse } = await prompts(
        {
          type: "toggle",
          name: "useLlamaParse",
          message:
            "Would you like to use LlamaParse (improved parser for RAG - requires API key)?",
          initial: false,
          active: "yes",
          inactive: "no",
        },
        questionHandlers,
      );
      program.useLlamaParse = useLlamaParse;

      // Ask for LlamaCloud API key
      if (useLlamaParse && program.llamaCloudKey === undefined) {
        const { llamaCloudKey } = await prompts(
          {
            type: "text",
            name: "llamaCloudKey",
            message:
              "Please provide your LlamaIndex Cloud API key (leave blank to skip):",
          },
          questionHandlers,
        );
        program.llamaCloudKey = llamaCloudKey;
      }
    }
  }

  if (program.dataSources.length > 0 && !program.vectorDb) {
    if (ciInfo.isCI) {
      program.vectorDb = getPrefOrDefault("vectorDb");
    } else {
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
      preferences.vectorDb = vectorDb;
    }
  }

  if (!program.tools) {
    if (ciInfo.isCI) {
      program.tools = getPrefOrDefault("tools");
    } else {
      const options = supportedTools.filter((t) =>
        t.supportedFrameworks?.includes(program.framework),
      );
      const toolChoices = options.map((tool) => ({
        title: tool.display,
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
      preferences.tools = tools;
    }
  }

  await askPostInstallAction();
};

export const toChoice = (value: string) => {
  return { title: value, value };
};
