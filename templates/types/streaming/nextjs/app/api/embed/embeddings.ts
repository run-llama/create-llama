import { Document, MetadataMode, Settings, SimpleNodeParser } from "llamaindex";
import pdf from "pdf-parse";

export async function splitAndEmbed(document: string) {
  const nodeParser = new SimpleNodeParser({
    chunkSize: Settings.chunkSize,
    chunkOverlap: Settings.chunkOverlap,
  });
  const nodes = nodeParser.getNodesFromDocuments([
    new Document({ text: document }),
  ]);
  const texts = nodes.map((node) => node.getContent(MetadataMode.EMBED));
  const embeddings = await Settings.embedModel.getTextEmbeddingsBatch(texts);
  return nodes.map((node, i) => ({
    text: node.getContent(MetadataMode.NONE),
    embedding: embeddings[i],
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
