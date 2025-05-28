#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");

// Resolve the project directory in node_modules/@llamaindex/server/project
// This is the template that used to construct the nextjs project
const projectDir = path.resolve(__dirname, "../project");

// Resolve the src directory that contains workflow & setting files
const srcDir = path.join(process.cwd(), "src");
const srcAppDir = path.join(srcDir, "app");
const generateFile = path.join(srcDir, "generate.ts");
const envFile = path.join(process.cwd(), ".env");

// The environment variables that are used as LlamaIndexServer configs
const SERVER_CONFIG_VARS = [
  {
    key: "OPENAI_API_KEY",
    defaultValue: "<your-openai-api-key>",
    description: "OpenAI API key",
  },
  {
    key: "SUGGEST_NEXT_QUESTIONS",
    defaultValue: "true",
    description: "Whether to suggest next questions (`suggestNextQuestions`)",
  },
  {
    key: "COMPONENTS_DIR",
    defaultValue: "components",
    description: "Directory for custom components (`componentsDir`)",
  },
  {
    key: "WORKFLOW_FILE_PATH",
    defaultValue: "app/api/chat/app/workflow.ts",
    description: "The path to the workflow file (will be updated in dev mode)",
  },
  {
    key: "NEXT_PUBLIC_USE_COMPONENTS_DIR",
    defaultValue: "true",
    description: "Whether to enable components directory feature on frontend",
  },
  {
    key: "NEXT_PUBLIC_DEV_MODE",
    defaultValue: "true",
    description: "Whether to enable dev mode (`devMode`)",
  },
  {
    key: "NEXT_PUBLIC_STARTER_QUESTIONS",
    defaultValue: '["Summarize the document", "What are the key points?"]',
    description:
      "Initial questions to display in the chat (`starterQuestions`)",
  },
  {
    key: "NEXT_PUBLIC_SHOW_LLAMACLOUD_SELECTOR",
    defaultValue: "false",
    description:
      "Whether to show LlamaCloud selector for frontend (`llamaCloudIndexSelector`)",
  },
];

async function eject() {
  try {
    // validate required directories (nextjs project template, src directory, src/app directory)
    const requiredDirs = [projectDir, srcDir, srcAppDir];
    for (const dir of requiredDirs) {
      const exists = await fs
        .access(dir)
        .then(() => true)
        .catch(() => false);
      if (!exists) {
        console.error("Error: directory does not exist at", dir);
        process.exit(1);
      }
    }

    // Get destination directory from command line arguments (pnpm eject <path>)
    const args = process.argv;
    const outputIndex = args.indexOf("eject");
    const destDir =
      outputIndex !== -1 && args[outputIndex + 1]
        ? path.resolve(args[outputIndex + 1]) // Use provided path after eject
        : path.join(process.cwd(), "next"); // Default to "next" folder in the current working directory

    // remove destination directory if it exists
    await fs.rm(destDir, { recursive: true, force: true });

    // create destination directory
    await fs.mkdir(destDir, { recursive: true });

    // Copy the nextjs project template to the destination directory
    await fs.cp(projectDir, destDir, { recursive: true });

    // copy src/app/* to destDir/app/api/chat
    const chatRouteDir = path.join(destDir, "app", "api", "chat");
    await fs.cp(srcAppDir, path.join(chatRouteDir, "app"), { recursive: true });

    // nextjs project doesn't depend on @llamaindex/server anymore, we need to update the imports in workflow file
    const workflowFile = path.join(chatRouteDir, "app", "workflow.ts");
    let workflowContent = await fs.readFile(workflowFile, "utf-8");
    workflowContent = workflowContent.replace("@llamaindex/server", "../utils");
    await fs.writeFile(workflowFile, workflowContent);

    // copy generate.ts if it exists
    const genFilePath = path.join(chatRouteDir, "generate.ts");
    const genFileExists = await copy(generateFile, genFilePath);
    if (genFileExists) {
      // update the import @llamaindex/server in generate.ts
      let genContent = await fs.readFile(genFilePath, "utf-8");
      genContent = genContent.replace("@llamaindex/server", "./utils");
      await fs.writeFile(genFilePath, genContent);
    }

    // copy folders in root directory if exists
    const rootFolders = ["components", "data", "output", "storage"];
    for (const folder of rootFolders) {
      await copy(path.join(process.cwd(), folder), path.join(destDir, folder));
    }

    // copy .env if it exists or create a new one
    const envFileExists = await copy(envFile, path.join(destDir, ".env"));
    if (!envFileExists) {
      await fs.writeFile(path.join(destDir, ".env"), "");
    }

    // update .env file with more server configs
    let envFileContent = await fs.readFile(path.join(destDir, ".env"), "utf-8");
    for (const envVar of SERVER_CONFIG_VARS) {
      const { key, defaultValue, description } = envVar;
      if (!envFileContent.includes(key)) {
        // if the key is not exists in the env file, add it
        envFileContent += `\n# ${description}\n${key}=${defaultValue}\n`;
      }
    }
    await fs.writeFile(path.join(destDir, ".env"), envFileContent);

    // rename gitignore -> .gitignore
    await fs.rename(
      path.join(destDir, "gitignore"),
      path.join(destDir, ".gitignore"),
    );

    // user can customize layout directory in nextjs project, remove layout api
    await fs.rm(path.join(destDir, "app", "api", "layout"), {
      recursive: true,
      force: true,
    });

    // remove no-needed files
    await fs.unlink(path.join(destDir, "public", "config.js"));
    await fs.unlink(path.join(destDir, "next-build.config.ts"));

    console.log("Successfully ejected @llamaindex/server to", destDir);
  } catch (error) {
    console.error("Error during eject:", error.message);
    process.exit(1);
  }
}

// copy src to dest if src exists, return true if src exists
async function copy(src, dest) {
  const srcExists = await fs
    .access(src)
    .then(() => true)
    .catch(() => false);
  if (srcExists) {
    await fs.cp(src, dest, { recursive: true });
  }
  return srcExists;
}

eject();
