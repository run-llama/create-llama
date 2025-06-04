import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MIME_TYPE_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

export const UPLOADED_FOLDER = "output/uploaded";

export async function storeFile(
  name: string,
  fileBuffer: Buffer,
  mimeType: string,
) {
  const fileExt = MIME_TYPE_TO_EXT[mimeType];
  if (!fileExt) throw new Error(`Unsupported document type: ${mimeType}`);

  const id = crypto.randomUUID();
  const fileId = `${sanitizeFileName(name)}_${id}.${fileExt}`;
  const filepath = path.join(UPLOADED_FOLDER, fileId);
  const fileUrl = await saveDocument(filepath, fileBuffer);
  return {
    id: fileId,
    name: name,
    size: fileBuffer.length,
    type: fileExt,
    url: fileUrl,
  };
}

// Save document to file server and return the file url
export async function saveDocument(filepath: string, content: string | Buffer) {
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
  // Remove file extension and ensure we have a valid string before sanitizing
  const nameWithoutExt = fileName.split(".")[0] || fileName;
  return nameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_");
}
