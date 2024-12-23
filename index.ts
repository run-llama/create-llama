/* eslint-disable import/no-extraneous-dependencies */
import { execSync } from "child_process";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { bold, cyan, green, red, yellow } from "picocolors";
import prompts from "prompts";
import terminalLink from "terminal-link";
import checkForUpdate from "update-check";
import { createApp } from "./create-app";
import { EXAMPLE_FILE, getDataSources } from "./helpers/datasources";
import { getPkgManager } from "./helpers/get-pkg-manager";
import { isFolderEmpty } from "./helpers/is-folder-empty";
import { initializeGlobalAgent } from "./helpers/proxy";
import { runApp } from "./helpers/run-app";
import { getTools } from "./helpers/tools";
import { validateNpmName } from "./helpers/validate-pkg";
import packageJson from "./package.json";
import { askQuestions } from "./questions/index";
import { QuestionArgs } from "./questions/types";
import { onPromptState } from "./questions/utils";
// Run the initialization function
initializeGlobalAgent();

let projectPath: string = "";

const handleSigTerm = () => process.exit(0);

process.on("SIGINT", handleSigTerm);
process.on("SIGTERM", handleSigTerm);

const program = new Command(packageJson.name)
  .version(packageJson.version)
  .arguments("[project-directory]")
  .usage(`${green("[project-directory]")} [options]`)
  .action((name) => {
    if (name) {
      projectPath = name;
    }
  })
  .option(
    "--use-npm",
    `

  Explicitly tell the CLI to bootstrap the application using npm
`,
  )
  .option(
    "--use-pnpm",
    `

  Explicitly tell the CLI to bootstrap the application using pnpm
`,
  )
  .option(
    "--use-yarn",
    `

  Explicitly tell the CLI to bootstrap the application using Yarn
`,
  )
  .option(
    "--template <template>",
    `

  Select a template to bootstrap the application with.
`,
  )
  .option(
    "--framework <framework>",
    `

  Select a framework to bootstrap the application with.
`,
  )
  .option(
    "--files <path>",
    `
  
  Specify the path to a local file or folder for chatting.
`,
  )
  .option(
    "--example-file",
    `

  Select to use an example PDF as data source.
`,
  )
  .option(
    "--web-source <url>",
    `
  
  Specify a website URL to use as a data source.
`,
  )
  .option(
    "--db-source <connection-string>",
    `
  
  Specify a database connection string to use as a data source.
`,
  )
  .option(
    "--open-ai-key <key>",
    `

  Provide an OpenAI API key.
`,
  )
  .option(
    "--ui <ui>",
    `

  Select a UI to bootstrap the application with.
`,
  )
  .option(
    "--frontend",
    `

  Generate a frontend for your backend.
`,
  )
  .option(
    "--no-frontend",
    `

  Do not generate a frontend for your backend.
`,
  )
  .option(
    "--port <port>",
    `

  Select UI port.
`,
  )
  .option(
    "--post-install-action <action>",
    `

  Choose an action after installation. For example, 'runApp' or 'dependencies'. The default option is just to generate the app.
`,
  )
  .option(
    "--vector-db <vectorDb>",
    `

  Select which vector database you would like to use, such as 'none', 'pg' or 'mongo'. The default option is not to use a vector database and use the local filesystem instead ('none').
`,
  )
  .option(
    "--tools <tools>",
    `

  Specify the tools you want to use by providing a comma-separated list. For example, 'wikipedia.WikipediaToolSpec,google.GoogleSearchToolSpec'. Use 'none' to not using any tools.
`,
    (tools, _) => {
      if (tools === "none") {
        return [];
      } else {
        return getTools(tools.split(","));
      }
    },
  )
  .option(
    "--use-llama-parse",
    `

  Enable LlamaParse.
`,
  )
  .option(
    "--llama-cloud-key <key>",
    `
  
  Provide a LlamaCloud API key.
`,
  )
  .option(
    "--observability <observability>",
    `
    
  Specify observability tools to use. Eg: none, opentelemetry
`,
  )
  .option(
    "--ask-models",
    `

  Allow interactive selection of LLM and embedding models of different model providers.
`,
    false,
  )
  .option(
    "--pro",
    `

  Allow interactive selection of all features.
`,
    false,
  )
  .option(
    "--agents <agents>",
    `

  Select which agents to use for the multi-agent template (e.g: financial_report, blog).
`,
  )
  .allowUnknownOption()
  .parse(process.argv);

const options = program.opts();

if (
  process.argv.includes("--no-llama-parse") ||
  options.template === "reflex"
) {
  options.useLlamaParse = false;
}
if (process.argv.includes("--no-files")) {
  options.dataSources = [];
} else if (process.argv.includes("--example-file")) {
  options.dataSources = getDataSources(options.files, options.exampleFile);
} else if (process.argv.includes("--llamacloud")) {
  options.dataSources = [EXAMPLE_FILE];
  options.vectorDb = "llamacloud";
} else if (process.argv.includes("--web-source")) {
  options.dataSources = [
    {
      type: "web",
      config: {
        baseUrl: options.webSource,
        prefix: options.webSource,
        depth: 1,
      },
    },
  ];
} else if (process.argv.includes("--db-source")) {
  options.dataSources = [
    {
      type: "db",
      config: {
        uri: options.dbSource,
        queries: options.dbQuery || "SELECT * FROM mytable",
      },
    },
  ];
}

const packageManager = !!options.useNpm
  ? "npm"
  : !!options.usePnpm
    ? "pnpm"
    : !!options.useYarn
      ? "yarn"
      : getPkgManager();

async function run(): Promise<void> {
  if (typeof projectPath === "string") {
    projectPath = projectPath.trim();
  }

  if (!projectPath) {
    const res = await prompts({
      onState: onPromptState,
      type: "text",
      name: "path",
      message: "What is your project named?",
      initial: "my-app",
      validate: (name) => {
        const validation = validateNpmName(path.basename(path.resolve(name)));
        if (validation.valid) {
          return true;
        }
        return "Invalid project name: " + validation.problems![0];
      },
    });

    if (typeof res.path === "string") {
      projectPath = res.path.trim();
    }
  }

  if (!projectPath) {
    console.log(
      "\nPlease specify the project directory:\n" +
        `  ${cyan(program.name())} ${green("<project-directory>")}\n` +
        "For example:\n" +
        `  ${cyan(program.name())} ${green("my-app")}\n\n` +
        `Run ${cyan(`${program.name()} --help`)} to see all options.`,
    );
    process.exit(1);
  }

  const resolvedProjectPath = path.resolve(projectPath);
  const projectName = path.basename(resolvedProjectPath);

  const { valid, problems } = validateNpmName(projectName);
  if (!valid) {
    console.error(
      `Could not create a project called ${red(
        `"${projectName}"`,
      )} because of npm naming restrictions:`,
    );

    problems!.forEach((p) => console.error(`    ${red(bold("*"))} ${p}`));
    process.exit(1);
  }

  /**
   * Verify the project dir is empty or doesn't exist
   */
  const root = path.resolve(resolvedProjectPath);
  const appName = path.basename(root);
  const folderExists = fs.existsSync(root);

  if (folderExists && !isFolderEmpty(root, appName)) {
    process.exit(1);
  }

  const answers = await askQuestions(options as unknown as QuestionArgs);

  await createApp({
    ...answers,
    appPath: resolvedProjectPath,
    packageManager,
  });

  if (answers.postInstallAction === "VSCode") {
    console.log(`Starting VSCode in ${root}...`);
    try {
      execSync(`code . --new-window --goto README.md`, {
        stdio: "inherit",
        cwd: root,
      });
    } catch (error) {
      console.log(
        red(
          `Failed to start VSCode in ${root}. 
Got error: ${(error as Error).message}.\n`,
        ),
      );
      console.log(
        `Make sure you have VSCode installed and added to your PATH (shell alias will not work). 
Please check ${cyan(
          terminalLink(
            "This documentation",
            `https://code.visualstudio.com/docs/setup/setup-overview`,
          ),
        )} for more information.`,
      );
    }
  } else if (answers.postInstallAction === "runApp") {
    console.log(`Running app in ${root}...`);
    await runApp(root, answers.template, answers.framework, options.port);
  }
}

const update = checkForUpdate(packageJson).catch(() => null);

async function notifyUpdate(): Promise<void> {
  try {
    const res = await update;
    if (res?.latest) {
      const updateMessage =
        packageManager === "yarn"
          ? "yarn global add create-llama@latest"
          : packageManager === "pnpm"
            ? "pnpm add -g create-llama@latest"
            : "npm i -g create-llama@latest";

      console.log(
        yellow(bold("A new version of `create-llama` is available!")) +
          "\n" +
          "You can update by running: " +
          cyan(updateMessage) +
          "\n",
      );
    }
  } catch {
    // ignore error
  }
}

run()
  .then(notifyUpdate)
  .catch(async (reason) => {
    console.log();
    console.log("Aborting installation.");
    if (reason.command) {
      console.log(`  ${cyan(reason.command)} has failed.`);
    } else {
      console.log(
        red("Unexpected error. Please report it as a bug:") + "\n",
        reason,
      );
    }
    console.log();

    await notifyUpdate();

    process.exit(1);
  });
