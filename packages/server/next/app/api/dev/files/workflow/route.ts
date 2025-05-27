import { exec } from "child_process";
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promisify } from "util";

const DEFAULT_WORKFLOW_FILE_PATH =
  process.env.WORKFLOW_FILE_PATH || "src/app/workflow.ts";

export async function GET(request: NextRequest) {
  const filePath = DEFAULT_WORKFLOW_FILE_PATH;

  const fileExists = await promisify(fs.exists)(DEFAULT_WORKFLOW_FILE_PATH);
  if (!fileExists) {
    return NextResponse.json(
      {
        detail: `Dev mode is currently in beta. It only supports updating workflow file at ${filePath}`,
      },
      { status: 404 },
    );
  }

  const content = await promisify(fs.readFile)(filePath, "utf-8");
  const last_modified = fs.statSync(filePath).mtime.getTime();

  return NextResponse.json(
    { content, file_path: filePath, last_modified },
    { status: 200 },
  );
}

export async function PUT(request: NextRequest) {
  const filePath = DEFAULT_WORKFLOW_FILE_PATH;
  const { content } = await request.json();

  const fileExists = await promisify(fs.exists)(filePath);
  if (!fileExists) {
    return NextResponse.json(
      {
        detail: `Dev mode is currently in beta. It only supports updating workflow file at ${DEFAULT_WORKFLOW_FILE_PATH}`,
      },
      { status: 404 },
    );
  }

  try {
    const resolvedFilePath = path.resolve(DEFAULT_WORKFLOW_FILE_PATH);
    const result = await validateTypeScriptFile(resolvedFilePath, content);

    if (!result.isValid) {
      return NextResponse.json(
        {
          detail: result.errors.join("\n"),
        },
        { status: 400 },
      );
    }

    await promisify(fs.writeFile)(filePath, content);
    return NextResponse.json({ content }, { status: 200 });
  } catch (error) {
    console.error("Error updating workflow file:", error);
    return NextResponse.json(
      { error: "Failed to update workflow file" },
      { status: 500 },
    );
  }
}

// use typescript package to validate the file syntax and imports
async function validateTypeScriptFile(filePath: string, content: string) {
  // Update workflow file directly will cause the server restart immediately.
  // So we create a temporary file with the same content in the same directory as the workflow file
  // This file will be used to validate the file syntax and imports. It will be deleted after validation.
  const tempFilePath = path.join(
    path.dirname(filePath),
    `workflow_${Date.now()}.ts`,
  );
  fs.writeFileSync(tempFilePath, content);

  const errors = [];
  try {
    const tscCommand = `npx tsc ${tempFilePath} --noEmit --skipLibCheck true`;
    await promisify(exec)(tscCommand);
  } catch (error) {
    const errorMessage = (error as { stdout: string })?.stdout;
    errors.push(errorMessage);
  } finally {
    // Clean up temporary file
    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}
