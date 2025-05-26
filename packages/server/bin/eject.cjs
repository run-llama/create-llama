#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs").promises;
const path = require("path");

// Resolve the source directory (@llamaindex/server/server)
const sourceDir = path.resolve(__dirname, "../server");

// Resolve the destination directory (consumer's project root/next)
const destDir = path.join(process.cwd(), "next");

async function eject() {
  try {
    // Check if source directory exists
    const sourceExists = await fs
      .access(sourceDir)
      .then(() => true)
      .catch(() => false);
    if (!sourceExists) {
      console.error("Error: Source directory does not exist at", sourceDir);
      process.exit(1);
    }

    // Remove next directory if it exists
    try {
      await fs.rm(destDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore error if directory doesn't exist
    }

    // Create next directory
    await fs.mkdir(destDir, { recursive: true });

    // Copy the server directory to the next folder
    await fs.cp(sourceDir, destDir, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
    console.log("Successfully ejected @llamaindex/server/server to", destDir);
  } catch (error) {
    if (error.code === "EEXIST") {
      console.error(
        "Error: One or more files already exist in the destination directory. Please ensure the destination is clear or manually merge the files.",
      );
    } else {
      console.error("Error during eject:", error.message);
    }
    process.exit(1);
  }
}

eject();
