import { exec } from "child_process";
import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { promisify } from "util";
import { parseRequestBody, sendJSONResponse } from "../utils/request";

export const handleServeFiles = async (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
) => {
  const filePath = pathname.substring("/api/files/".length);
  if (!filePath.startsWith("output") && !filePath.startsWith("data")) {
    return sendJSONResponse(res, 400, { error: "No permission" });
  }
  const decodedFilePath = decodeURIComponent(filePath);
  const fileExists = await promisify(fs.exists)(decodedFilePath);
  if (fileExists) {
    const fileStream = fs.createReadStream(decodedFilePath);
    fileStream.pipe(res);
  } else {
    return sendJSONResponse(res, 404, { error: "File not found" });
  }
};

const DEFAULT_WORKFLOW_FILE_PATH = "src/app/workflow.ts"; // TODO: we can make it as a parameter in server later

export const getWorkflowFile = async (
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string = DEFAULT_WORKFLOW_FILE_PATH,
) => {
  const fileExists = await promisify(fs.exists)(filePath);
  if (!fileExists) {
    return sendJSONResponse(res, 404, {
      detail: `Dev mode is currently in beta. It only supports updating workflow file at ${DEFAULT_WORKFLOW_FILE_PATH}`,
    });
  }

  const content = await promisify(fs.readFile)(filePath, "utf-8");
  const last_modified = fs.statSync(filePath).mtime.getTime();
  sendJSONResponse(res, 200, { content, file_path: filePath, last_modified });
};

export const updateWorkflowFile = async (
  req: IncomingMessage,
  res: ServerResponse,
  filePath: string = DEFAULT_WORKFLOW_FILE_PATH,
) => {
  const body = await parseRequestBody(req);
  const { content } = body as { content: string };

  const fileExists = await promisify(fs.exists)(filePath);
  if (!fileExists) {
    return sendJSONResponse(res, 404, {
      detail: `Dev mode is currently in beta. It only supports updating workflow file at ${DEFAULT_WORKFLOW_FILE_PATH}`,
    });
  }

  try {
    const resolvedFilePath = path.resolve(DEFAULT_WORKFLOW_FILE_PATH);
    const result = await validateTypeScriptFile(resolvedFilePath, content);

    if (!result.isValid) {
      return sendJSONResponse(res, 400, {
        detail: result.errors.join("\n"),
      });
    }

    await promisify(fs.writeFile)(filePath, content);
    sendJSONResponse(res, 200, { content });
  } catch (error) {
    console.error("Error updating workflow file:", error);
    sendJSONResponse(res, 500, { error: "Failed to update workflow file" });
  }
};

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
