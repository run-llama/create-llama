import {
  Document,
  IngestionPipeline,
  MetadataMode,
  Settings,
  SimpleNodeParser,
  TextNode,
} from "llamaindex";
import { PDFReader } from "llamaindex/readers/PDFReader";

export async function readAndSplitDocument(
  base64: string,
): Promise<Pick<TextNode, "text" | "embedding">[]> {
  const [header, content] = base64.split(",");
  const mimeType = header.replace("data:", "").replace(";base64", "");
  console.log(`Processing uploaded document of type: ${mimeType}`);
  // TODO: select right reader based on mimeType
  const pdfBuffer = new Uint8Array(Buffer.from(content, "base64"));
  const reader = new PDFReader();
  const documents = await reader.loadDataAsContent(pdfBuffer);
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
