import { Document } from "llamaindex";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getExtractors } from "../../engine/loader";

const MIME_TYPE_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

const UPLOADED_FOLDER = "output/uploaded";

export type FileMetadata = {
  id: string;
  name: string;
  url: string;
  refs: string[];
};

export async function storeAndParseFile(
  filename: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<FileMetadata> {
  const fileMetadata = await storeFile(filename, fileBuffer, mimeType);
  const documents: Document[] = await parseFile(fileBuffer, filename, mimeType);
  // Update document IDs in the file metadata
  fileMetadata.refs = documents.map((document) => document.id_ as string);
  return fileMetadata;
}

export async function storeFile(
  filename: string,
  fileBuffer: Buffer,
  mimeType: string,
) {
  const fileExt = MIME_TYPE_TO_EXT[mimeType];
  if (!fileExt) throw new Error(`Unsupported document type: ${mimeType}`);

  const fileId = crypto.randomUUID();
  const newFilename = `${fileId}_${sanitizeFileName(filename)}`;
  const filepath = path.join(UPLOADED_FOLDER, newFilename);
  const fileUrl = await saveDocument(filepath, fileBuffer);
  return {
    id: fileId,
    name: newFilename,
    url: fileUrl,
    refs: [] as string[],
  } as FileMetadata;
}

export async function parseFile(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
) {
  const documents = await loadDocuments(fileBuffer, mimeType);
  for (const document of documents) {
    document.metadata = {
      ...document.metadata,
      file_name: filename,
      private: "true", // to separate private uploads from public documents
    };
  }
  return documents;
}

async function loadDocuments(fileBuffer: Buffer, mimeType: string) {
  const extractors = getExtractors();
  const reader = extractors[MIME_TYPE_TO_EXT[mimeType]];

  if (!reader) {
    throw new Error(`Unsupported document type: ${mimeType}`);
  }
  console.log(`Processing uploaded document of type: ${mimeType}`);
  return await reader.loadDataAsContent(fileBuffer);
}

// Save document to file server and return the file url
export async function saveDocument(filepath: string, content: string | Buffer) {
  if (path.isAbsolute(filepath)) {
    throw new Error("Absolute file paths are not allowed.");
  }
  if (!process.env.FILESERVER_URL_PREFIX) {
    throw new Error("FILESERVER_URL_PREFIX environment variable is not set.");
  }

  const dirPath = path.dirname(filepath);
  await fs.promises.mkdir(dirPath, { recursive: true });

  if (typeof content === "string") {
    await fs.promises.writeFile(filepath, content, "utf-8");
  } else {
    await fs.promises.writeFile(filepath, content);
  }

  const fileurl = `${process.env.FILESERVER_URL_PREFIX}/${filepath}`;
  console.log(`Saved document to ${filepath}. Reachable at URL: ${fileurl}`);
  return fileurl;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
}
