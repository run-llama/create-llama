import { execSync } from "child_process";
import ciInfo from "ci-info";
import fs from "fs";
import got from "got";
import ora from "ora";
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
import { templatesDir } from "./helpers/dir";
import { getAvailableLlamapackOptions } from "./helpers/llama-pack";
import { getProjectOptions } from "./helpers/repo";
import { supportedTools, toolsRequireConfig } from "./helpers/tools";

const OPENAI_API_URL = "https://api.openai.com/v1";

export type QuestionArgs = Omit<
  InstallAppArgs,
  "appPath" | "packageManager"
> & {
  files?: string;
  listServerModels?: boolean;
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

const defaults: QuestionArgs = {
  template: "streaming",
  framework: "nextjs",
  engine: "simple",
  ui: "html",
  eslint: true,
  frontend: false,
  openAiKey: "",
  llamaCloudKey: "",
  useLlamaParse: false,
  model: "gpt-3.5-turbo",
  embeddingModel: "text-embedding-ada-002",
  communityProjectConfig: undefined,
  llamapack: "",
  postInstallAction: "dependencies",
  dataSources: [],
  tools: [],
};

const handlers = {
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
      title: "No data, just a simple chat",
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

const getAvailableModelChoices = async (
  selectEmbedding: boolean,
  apiKey?: string,
  listServerModels?: boolean,
) => {
  const defaultLLMModels = [
    "gpt-3.5-turbo-0125",
    "gpt-4-turbo-preview",
    "gpt-4",
    "gpt-4-vision-preview",
  ];
  const defaultEmbeddingModels = [
    "text-embedding-ada-002",
    "text-embedding-3-small",
    "text-embedding-3-large",
  ];

  const isLLMModels = (model_id: string) => {
    return model_id.startsWith("gpt");
  };

  const isEmbeddingModel = (model_id: string) => {
    return (
      model_id.includes("embedding") ||
      defaultEmbeddingModels.includes(model_id)
    );
  };

  if (apiKey && listServerModels) {
    const spinner = ora("Fetching available models").start();
    try {
      const response = await got(`${OPENAI_API_URL}/models`, {
        headers: {
          Authorization: "Bearer " + apiKey,
        },
        timeout: 5000,
        responseType: "json",
      });
      const data: any = await response.body;
      spinner.stop();
      return data.data
        .filter((model: any) =>
          selectEmbedding ? isEmbeddingModel(model.id) : isLLMModels(model.id),
        )
        .map((el: any) => {
          return {
            title: el.id,
            value: el.id,
          };
        });
    } catch (error) {
      spinner.stop();
      if ((error as any).response?.statusCode === 401) {
        console.log(
          red(
            "Invalid OpenAI API key provided! Please provide a valid key and try again!",
          ),
        );
      } else {
        console.log(red("Request failed: " + error));
      }
      process.exit(1);
    }
  } else {
    const data = selectEmbedding ? defaultEmbeddingModels : defaultLLMModels;
    return data.map((model) => ({
      title: model,
      value: model,
    }));
  }
};

export const askQuestions = async (
  program: QuestionArgs,
  preferences: QuestionArgs,
) => {
  const getPrefOrDefault = <K extends keyof QuestionArgs>(
    field: K,
  ): QuestionArgs[K] => preferences[field] ?? defaults[field];

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

        const openAiKeyConfigured =
          program.openAiKey || process.env["OPENAI_API_KEY"];
        // If using LlamaParse, require LlamaCloud API key
        const llamaCloudKeyConfigured = program.useLlamaParse
          ? program.llamaCloudKey || process.env["LLAMA_CLOUD_API_KEY"]
          : true;
        const hasVectorDb = program.vectorDb && program.vectorDb !== "none";
        // Can run the app if all tools do not require configuration
        if (
          !hasVectorDb &&
          openAiKeyConfigured &&
          llamaCloudKeyConfigured &&
          !toolsRequireConfig(program.tools) &&
          !program.llamapack
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
          handlers,
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
            { title: "Chat without streaming", value: "simple" },
            { title: "Chat with streaming", value: "streaming" },
            {
              title: `Community template from ${styledRepo}`,
              value: "community",
            },
            {
              title: "Example using a LlamaPack",
              value: "llamapack",
            },
          ],
          initial: 1,
        },
        handlers,
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
      handlers,
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
      handlers,
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
        { title: "Express", value: "express" },
        { title: "FastAPI (Python)", value: "fastapi" },
      ];
      if (program.template === "streaming") {
        // allow NextJS only for streaming template
        choices.unshift({ title: "NextJS", value: "nextjs" });
      }

      const { framework } = await prompts(
        {
          type: "select",
          name: "framework",
          message: "Which framework would you like to use?",
          choices,
          initial: 0,
        },
        handlers,
      );
      program.framework = framework;
      preferences.framework = framework;
    }
  }

  if (
    program.template === "streaming" &&
    (program.framework === "express" || program.framework === "fastapi")
  ) {
    // if a backend-only framework is selected, ask whether we should create a frontend
    // (only for streaming backends)
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
      if (ciInfo.isCI) {
        program.ui = getPrefOrDefault("ui");
      } else {
        const { ui } = await prompts(
          {
            type: "select",
            name: "ui",
            message: "Which UI would you like to use?",
            choices: [
              { title: "Just HTML", value: "html" },
              { title: "Shadcn", value: "shadcn" },
            ],
            initial: 0,
          },
          handlers,
        );
        program.ui = ui;
        preferences.ui = ui;
      }
    }
  }

  if (program.framework === "express" || program.framework === "nextjs") {
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
          handlers,
        );

        program.observability = observability;
        preferences.observability = observability;
      }
    }
  }

  if (!program.openAiKey) {
    const { key } = await prompts(
      {
        type: "text",
        name: "key",
        message: program.listServerModels
          ? "Please provide your OpenAI API key (or reuse OPENAI_API_KEY env variable):"
          : "Please provide your OpenAI API key (leave blank to skip):",
        validate: (value: string) => {
          if (program.listServerModels && !value) {
            if (process.env.OPENAI_API_KEY) {
              return true;
            }
            return "OpenAI API key is required";
          }
          return true;
        },
      },
      handlers,
    );

    program.openAiKey = key || process.env.OPENAI_API_KEY;
    preferences.openAiKey = key || process.env.OPENAI_API_KEY;
  }

  if (!program.model) {
    if (ciInfo.isCI) {
      program.model = getPrefOrDefault("model");
    } else {
      const { model } = await prompts(
        {
          type: "select",
          name: "model",
          message: "Which model would you like to use?",
          choices: await getAvailableModelChoices(
            false,
            program.openAiKey,
            program.listServerModels,
          ),
          initial: 0,
        },
        handlers,
      );
      program.model = model;
      preferences.model = model;
    }
  }

  if (!program.embeddingModel && program.framework === "fastapi") {
    if (ciInfo.isCI) {
      program.embeddingModel = getPrefOrDefault("embeddingModel");
    } else {
      const { embeddingModel } = await prompts(
        {
          type: "select",
          name: "embeddingModel",
          message: "Which embedding model would you like to use?",
          choices: await getAvailableModelChoices(
            true,
            program.openAiKey,
            program.listServerModels,
          ),
          initial: 0,
        },
        handlers,
      );
      program.embeddingModel = embeddingModel;
      preferences.embeddingModel = embeddingModel;
    }
  }

  if (program.files) {
    // If user specified files option, then the program should use context engine
    program.engine = "context";
    program.files.split(",").forEach((filePath) => {
      program.dataSources.push({
        type: "file",
        config: {
          path: filePath,
        },
      });
    });
  }

  if (!program.engine) {
    if (ciInfo.isCI) {
      program.engine = getPrefOrDefault("engine");
      program.dataSources = getPrefOrDefault("dataSources");
    } else {
      program.dataSources = [];
      while (true) {
        const { selectedSource } = await prompts(
          {
            type: "select",
            name: "selectedSource",
            message:
              program.dataSources.length === 0
                ? "Which data source would you like to use?"
                : "Would you like to add another data source?",
            choices: getDataSourceChoices(
              program.framework,
              program.dataSources,
            ),
            initial: 0,
          },
          handlers,
        );

        if (selectedSource === "no") {
          break;
        }

        if (selectedSource === "none") {
          // Selected simple chat
          program.dataSources = [];
          // Stop asking for another data source
          break;
        }

        if (selectedSource === "exampleFile") {
          program.dataSources.push({
            type: "file",
            config: {},
          });
        } else if (selectedSource === "file" || selectedSource === "folder") {
          // Select local data source
          const selectedPaths = await selectLocalContextData(selectedSource);
          for (const p of selectedPaths) {
            program.dataSources.push({
              type: "file",
              config: {
                path: p,
              },
            });
          }
        } else if (selectedSource === "web") {
          // Selected web data source
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
            handlers,
          );

          program.dataSources.push({
            type: "web",
            config: {
              baseUrl,
              prefix: baseUrl,
              depth: 1,
            },
          });
        }
      }

      if (program.dataSources.length === 0) {
        program.engine = "simple";
      } else {
        program.engine = "context";
      }
    }
  } else if (!program.dataSources) {
    // Handle a case when engine is specified but dataSource is not
    if (program.engine === "context") {
      program.dataSources = [
        {
          type: "file",
          config: {},
        },
      ];
    } else if (program.engine === "simple") {
      program.dataSources = [];
    }
  }

  // Asking for LlamaParse if user selected file or folder data source
  if (
    program.dataSources.some((ds) => ds.type === "file") &&
    !program.useLlamaParse
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
          initial: true,
          active: "yes",
          inactive: "no",
        },
        handlers,
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
          handlers,
        );
        program.llamaCloudKey = llamaCloudKey;
      }
    }
  }

  if (program.engine !== "simple" && !program.vectorDb) {
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
        handlers,
      );
      program.vectorDb = vectorDb;
      preferences.vectorDb = vectorDb;
    }
  }

  if (!program.tools && program.engine === "context") {
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

  if (program.framework !== "fastapi" && program.eslint === undefined) {
    if (ciInfo.isCI) {
      program.eslint = getPrefOrDefault("eslint");
    } else {
      const styledEslint = blue("ESLint");
      const { eslint } = await prompts({
        onState: onPromptState,
        type: "toggle",
        name: "eslint",
        message: `Would you like to use ${styledEslint}?`,
        initial: getPrefOrDefault("eslint"),
        active: "Yes",
        inactive: "No",
      });
      program.eslint = Boolean(eslint);
      preferences.eslint = Boolean(eslint);
    }
  }

  await askPostInstallAction();

  // TODO: consider using zod to validate the input (doesn't work like this as not every option is required)
  // templateUISchema.parse(program.ui);
  // templateEngineSchema.parse(program.engine);
  // templateFrameworkSchema.parse(program.framework);
  // templateTypeSchema.parse(program.template);``
};
