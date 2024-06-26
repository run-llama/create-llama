import {
  Document,
  IngestionPipeline,
  MetadataMode,
  Settings,
  SimpleNodeParser,
} from "llamaindex";
import pdf from "pdf-parse";

export async function splitAndEmbed(content: string) {
  const document = new Document({ text: content });
  const pipeline = new IngestionPipeline({
    transformations: [
      new SimpleNodeParser({
        chunkSize: Settings.chunkSize,
        chunkOverlap: Settings.chunkOverlap,
      }),
      Settings.embedModel,
    ],
  });
  const nodes = await pipeline.run({ documents: [document] });
  return nodes.map((node, i) => ({
    text: node.getContent(MetadataMode.NONE),
    embedding: node.embedding,
  }));
}

export async function getPdfDetail(rawPdf: string) {
  const pdfBuffer = Buffer.from(rawPdf.split(",")[1], "base64");
  const content = (await pdf(pdfBuffer)).text;
  const embeddings = await splitAndEmbed(content);
  return {
    content,
    embeddings,
  };
}
