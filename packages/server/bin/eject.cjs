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
    description: "Whether to suggest next questions",
  },
  {
    key: "COMPONENTS_DIR",
    defaultValue: "components",
    description: "Directory for custom components",
  },
  {
    key: "LAYOUT_DIR",
    defaultValue: "layout",
    description: "Directory for custom layout",
  },
];

// The default frontend config.js file content
const DEFAULT_FRONTEND_CONFIG = `
window.LLAMAINDEX = {
  // these endpoints are fixed in the ejected nextjs project, don't change them
  CHAT_API: '/api/chat',
  COMPONENTS_API: '/api/components',

  // update these values to customize frontend
  DEV_MODE: true, // whether to enable dev mode
  STARTER_QUESTIONS: [], // initial questions to display in the chat

  // uncomment this to enable LlamaCloud (need to set LLAMA_CLOUD_API_KEY in .env)
  // LLAMA_CLOUD_API: '/api/chat/config/llamacloud',
}
`.trim();

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

    // Get destination directory from command line arguments (pnpm eject --output <path>)
    const args = process.argv;
    const outputIndex = args.indexOf("--output");
    const destDir =
      outputIndex !== -1 && args[outputIndex + 1]
        ? path.resolve(args[outputIndex + 1]) // Use provided path after --output
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

    // copy generate.ts if it exists
    await copy(generateFile, path.join(chatRouteDir, "generate.ts"));

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

    // update frontend config.js file
    const frontendConfigFile = path.join(destDir, "public", "config.js");
    let frontendConfigContent = DEFAULT_FRONTEND_CONFIG;
    if (envFileContent.includes("LLAMA_CLOUD_API_KEY")) {
      // if user has LLAMA_CLOUD_API_KEY in .env, auto enable LlamaCloud for frontend
      frontendConfigContent = frontendConfigContent.replace(
        "// LLAMA_CLOUD_API",
        "LLAMA_CLOUD_API",
      );
    }
    await fs.writeFile(frontendConfigFile, frontendConfigContent);

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

    // clean up, remove no-needed files
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
