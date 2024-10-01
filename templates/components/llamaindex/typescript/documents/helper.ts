import fs from "node:fs";
import path from "node:path";
import { getExtractors } from "../../engine/loader";

const MIME_TYPE_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

const UPLOADED_FOLDER = "output/uploaded";

export async function storeAndParseFile(
  filename: string,
  fileBuffer: Buffer,
  mimeType: string,
) {
  const fileExt = MIME_TYPE_TO_EXT[mimeType];
  if (!fileExt) throw new Error(`Unsupported document type: ${mimeType}`);

  const documents = await loadDocuments(fileBuffer, mimeType);
  const filepath = path.join(UPLOADED_FOLDER, filename);
  await saveDocument(filepath, fileBuffer);
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
  const fileName = path.basename(filepath);
  if (!/^[a-zA-Z0-9_.-]+$/.test(fileName)) {
    throw new Error(
      "File name is not allowed to contain any special characters.",
    );
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
