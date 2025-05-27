#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");

// Resolve the project directory in node_modules/@llamaindex/server/project
// This is the template that used to construct the nextjs project
const projectDir = path.resolve(__dirname, "../project");

// Resolve the src directory that contains workflow & setting files
const srcDir = path.join(process.cwd(), "src");
const srcAppDir = path.join(srcDir, "app");
const generateFile = path.join(srcDir, "generate.ts"); // optional, used to generate embeddings for index

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
    const generateFileExists = await fs
      .access(generateFile)
      .then(() => true)
      .catch(() => false);
    if (generateFileExists) {
      await fs.cp(generateFile, path.join(chatRouteDir, "generate.ts"));
    }

    // rename gitignore -> .gitignore
    await fs.rename(
      path.join(destDir, "gitignore"),
      path.join(destDir, ".gitignore"),
    );

    // TODO: get current package.json and merge it with next-package.json (we need generate scripts)

    console.log("Successfully ejected @llamaindex/server/server to", destDir);
  } catch (error) {
    console.error("Error during eject:", error.message);
    process.exit(1);
  }
}

eject();
