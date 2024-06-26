import { Document, MetadataMode, Settings, SimpleNodeParser } from "llamaindex";
import pdf from "pdf-parse";

export async function splitAndEmbed(content: string) {
  // const document = new Document({ text: content, id_: "123" });
  // const pipeline = new IngestionPipeline({
  //   transformations: [
  //     new SimpleNodeParser({
  //       chunkSize: Settings.chunkSize,
  //       chunkOverlap: Settings.chunkOverlap,
  //     }),
  //     Settings.embedModel,
  //   ],
  // });
  // const nodes = await pipeline.run({ documents: [document] });
  // return nodes;

  const nodeParser = new SimpleNodeParser({
    chunkSize: Settings.chunkSize,
    chunkOverlap: Settings.chunkOverlap,
  });
  const nodes = nodeParser.getNodesFromDocuments([
    new Document({ text: content }),
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
