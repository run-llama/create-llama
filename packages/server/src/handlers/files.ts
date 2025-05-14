import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import ts from "typescript";
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
    const result = validateTypeScriptFile(filePath);
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
function validateTypeScriptFile(filePath: string) {
  // Create a TypeScript program
  const program = ts.createProgram([filePath], {
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    allowJs: false,
  });

  // Get diagnostics (errors and warnings)
  const diagnostics = ts.getPreEmitDiagnostics(program);

  // Format and return errors
  const errors = diagnostics.map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      "\n",
    );
    const { line, character } = diagnostic.file
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0)
      : { line: 0, character: 0 };
    return `Error at line ${line + 1}, character ${character + 1}: ${message}`;
  });

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
}
