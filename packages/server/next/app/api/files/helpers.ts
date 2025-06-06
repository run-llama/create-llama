import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { type ServerFile } from "@llamaindex/server";

export const UPLOADED_FOLDER = "output/uploaded";

export async function storeFile(
  name: string,
  fileBuffer: Buffer,
): Promise<ServerFile> {
  const parts = name.split(".");
  const fileName = parts[0];
  const fileExt = parts[1];
  if (!fileName) {
    throw new Error("File name is required");
  }
  if (!fileExt) {
    throw new Error("File extension is required");
  }

  const id = crypto.randomUUID();
  const fileId = `${sanitizeFileName(fileName)}_${id}.${fileExt}`;
  const filepath = path.join(UPLOADED_FOLDER, fileId);
  const fileUrl = await saveFile(filepath, fileBuffer);
  return {
    id: fileId,
    size: fileBuffer.length,
    type: fileExt,
    url: fileUrl,
    path: filepath,
  };
}

// Save document to file server and return the file url
async function saveFile(filepath: string, content: string | Buffer) {
  if (path.isAbsolute(filepath)) {
    throw new Error("Absolute file paths are not allowed.");
  }

  const dirPath = path.dirname(filepath);
  await fs.promises.mkdir(dirPath, { recursive: true });

  if (typeof content === "string") {
    await fs.promises.writeFile(filepath, content, "utf-8");
  } else {
    await fs.promises.writeFile(filepath, content);
  }

  const fileurl = `/api/files/${filepath}`;
  return fileurl;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_-]/g, "_");
}
