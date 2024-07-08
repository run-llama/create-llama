import fs from "fs";
import {
  BaseNode,
  Document,
  IngestionPipeline,
  Metadata,
  Settings,
  SimpleNodeParser,
  storageContextFromDefaults,
  VectorStoreIndex,
} from "llamaindex";
import { DocxReader } from "llamaindex/readers/DocxReader";
import { PDFReader } from "llamaindex/readers/PDFReader";
import { TextFileReader } from "llamaindex/readers/TextFileReader";
import crypto from "node:crypto";
import { getDataSource } from "../engine";
import { STORAGE_CACHE_DIR } from "../engine/shared";

const MIME_TYPE_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

export async function uploadDocument(raw: string): Promise<string[]> {
  const [header, content] = raw.split(",");
  const mimeType = header.replace("data:", "").replace(";base64", "");
  const fileBuffer = Buffer.from(content, "base64");
  const documents = await loadDocuments(fileBuffer, mimeType);
  await saveDocument(fileBuffer, mimeType);
  return await runPipeline(documents);
}

async function runPipeline(documents: Document[]): Promise<string[]> {
  // mark documents to add to the vector store as private
  for (const document of documents) {
    document.metadata = {
      ...document.metadata,
      private: true,
    };
  }
  const pipeline = new IngestionPipeline({
    transformations: [
      new SimpleNodeParser({
        chunkSize: Settings.chunkSize,
        chunkOverlap: Settings.chunkOverlap,
      }),
      Settings.embedModel,
    ],
  });
  const nodes = await pipeline.run({ documents });
  await addNodesToVectorStore(nodes);
  return documents.map((document) => document.id_);
}

async function loadDocuments(fileBuffer: Buffer, mimeType: string) {
  console.log(`Processing uploaded document of type: ${mimeType}`);
  switch (mimeType) {
    case "application/pdf":
      const pdfReader = new PDFReader();
      return await pdfReader.loadDataAsContent(new Uint8Array(fileBuffer));
    case "text/plain":
      const textReader = new TextFileReader();
      return await textReader.loadDataAsContent(fileBuffer);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      const docxReader = new DocxReader();
      return await docxReader.loadDataAsContent(fileBuffer);
    default:
      throw new Error(`Unsupported document type: ${mimeType}`);
  }
}

async function saveDocument(fileBuffer: Buffer, mimeType: string) {
  const fileExt = MIME_TYPE_TO_EXT[mimeType];
  if (!fileExt) throw new Error(`Unsupported document type: ${mimeType}`);

  const folder = "data/private";
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

async function addNodesToVectorStore(nodes: BaseNode<Metadata>[]) {
  let currentIndex = await getDataSource();
  if (currentIndex) {
    await currentIndex.insertNodes(nodes);
  } else {
    const storageContext = await storageContextFromDefaults({
      persistDir: `${STORAGE_CACHE_DIR}`,
    });
    currentIndex = await VectorStoreIndex.init({ nodes, storageContext });
  }
  currentIndex.storageContext.docStore.persist(STORAGE_CACHE_DIR);
  console.log(
    `Added nodes to the vector store. Storage directory: ${STORAGE_CACHE_DIR}`,
  );
}
