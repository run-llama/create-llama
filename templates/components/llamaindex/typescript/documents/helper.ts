import fs from "fs";
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
  const documents = await loadDocuments(fileBuffer, mimeType);
  await saveDocument(filename, fileBuffer, mimeType);
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

async function saveDocument(
  filename: string,
  fileBuffer: Buffer,
  mimeType: string,
) {
  const fileExt = MIME_TYPE_TO_EXT[mimeType];
  if (!fileExt) throw new Error(`Unsupported document type: ${mimeType}`);

  const filepath = `${UPLOADED_FOLDER}/${filename}`;
  const fileurl = `${process.env.FILESERVER_URL_PREFIX}/${filepath}`;

  if (!fs.existsSync(UPLOADED_FOLDER)) {
    fs.mkdirSync(UPLOADED_FOLDER, { recursive: true });
  }
  await fs.promises.writeFile(filepath, fileBuffer);

  console.log(`Saved document file to ${filepath}.\nURL: ${fileurl}`);
  return {
    filename,
    filepath,
    fileurl,
  };
}
