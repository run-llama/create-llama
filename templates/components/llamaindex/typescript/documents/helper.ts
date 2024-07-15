import fs from "fs";
import { DocxReader } from "llamaindex/readers/DocxReader";
import { PDFReader } from "llamaindex/readers/PDFReader";
import { TextFileReader } from "llamaindex/readers/TextFileReader";
import crypto from "node:crypto";

const MIME_TYPE_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

export async function loadDocuments(fileBuffer: Buffer, mimeType: string) {
  console.log(`Processing uploaded document of type: ${mimeType}`);
  switch (mimeType) {
    case "application/pdf": {
      const pdfReader = new PDFReader();
      return await pdfReader.loadDataAsContent(new Uint8Array(fileBuffer));
    }
    case "text/plain": {
      const textReader = new TextFileReader();
      return await textReader.loadDataAsContent(fileBuffer);
    }
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const docxReader = new DocxReader();
      return await docxReader.loadDataAsContent(fileBuffer);
    }
    default:
      throw new Error(`Unsupported document type: ${mimeType}`);
  }
}

export async function saveDocument(fileBuffer: Buffer, mimeType: string) {
  const fileExt = MIME_TYPE_TO_EXT[mimeType];
  if (!fileExt) throw new Error(`Unsupported document type: ${mimeType}`);

  const folder = "output/uploaded";
  const filename = `${crypto.randomUUID()}.${fileExt}`;
  const filepath = `${folder}/${filename}`;
  const fileurl = `${process.env.FILESERVER_URL_PREFIX}/${filepath}`;

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
  await fs.promises.writeFile(filepath, fileBuffer);

  console.log(`Saved document file to ${filepath}.\nURL: ${fileurl}`);
  return {
    filename,
    filepath,
    fileurl,
  };
}
