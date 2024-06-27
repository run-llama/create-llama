import {
  Document,
  IngestionPipeline,
  MetadataMode,
  Settings,
  SimpleNodeParser,
  TextNode,
} from "llamaindex";
import { DocxReader } from "llamaindex/readers/DocxReader";
import { PDFReader } from "llamaindex/readers/PDFReader";
import { TextFileReader } from "llamaindex/readers/TextFileReader";

export async function readAndSplitDocument(
  raw: string,
): Promise<Pick<TextNode, "text" | "embedding">[]> {
  const [header, content] = raw.split(",");
  const mimeType = header.replace("data:", "").replace(";base64", "");
  const fileBuffer = Buffer.from(content, "base64");
  const documents = await loadDocuments(fileBuffer, mimeType);
  return await runPipeline(documents);
}

async function runPipeline(
  documents: Document[],
): Promise<Pick<TextNode, "text" | "embedding">[]> {
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
  // remove metadata from text nodes to reduce data send over the wire
  return nodes.map((node) => ({
    text: node.getContent(MetadataMode.NONE),
    embedding: node.embedding,
  }));
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
