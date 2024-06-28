import { JSONValue } from "ai";
import { MessageContent, MessageContentDetail, TextNode } from "llamaindex";

export type DocumentFileType = "csv" | "pdf" | "txt" | "docx";

export type DocumentFile = {
  id: string;
  filename: string;
  filesize: number;
  filetype: DocumentFileType;
  content: string | TextNode[];
};

type Annotation = {
  type: string;
  data: object;
};

export function retrieveNodes(annotations?: JSONValue[]): TextNode[] {
  if (!annotations) return [];

  const textNodes: TextNode[] = [];

  annotations.forEach((annotation: JSONValue) => {
    const { type, data } = getValidAnnotation(annotation);
    if (
      type === "document_file" &&
      "files" in data &&
      Array.isArray(data.files)
    ) {
      const files = data.files as DocumentFile[];
      files.forEach((file) => {
        if (Array.isArray(file.content)) {
          file.content.forEach((node) => {
            if (node.hasOwnProperty("text")) {
              textNodes.push(
                new TextNode({
                  text: node.text,
                  embedding: node.embedding,
                  metadata: node.metadata,
                }),
              );
            }
          });
        }
      });
    }
  });

  return textNodes;
}

export function convertMessageContent(
  content: string,
  annotations?: JSONValue[],
): MessageContent {
  if (!annotations) return content;
  return [
    {
      type: "text",
      text: content,
    },
    ...convertAnnotations(annotations),
  ];
}

function convertAnnotations(annotations: JSONValue[]): MessageContentDetail[] {
  const content: MessageContentDetail[] = [];
  annotations.forEach((annotation: JSONValue) => {
    const { type, data } = getValidAnnotation(annotation);
    // convert image
    if (type === "image" && "url" in data && typeof data.url === "string") {
      content.push({
        type: "image_url",
        image_url: {
          url: data.url,
        },
      });
    }
    // convert the content of files to a text message
    if (
      type === "document_file" &&
      "files" in data &&
      Array.isArray(data.files)
    ) {
      // get all CSV files and convert their whole content to one text message
      // currently CSV files are the only files where we send the whole content - we don't use an index
      const csvFiles = data.files.filter(
        (file: DocumentFile) => file.filetype === "csv",
      );
      if (csvFiles && csvFiles.length > 0) {
        const csvContents = csvFiles.map(
          (file: DocumentFile) => "```csv\n" + file.content + "\n```",
        );
        const text =
          "Use the following CSV content:\n" + csvContents.join("\n\n");
        content.push({
          type: "text",
          text,
        });
      }
    }
  });

  return content;
}

function getValidAnnotation(annotation: JSONValue): Annotation {
  if (
    !(
      annotation &&
      typeof annotation === "object" &&
      "type" in annotation &&
      typeof annotation.type === "string" &&
      "data" in annotation &&
      annotation.data &&
      typeof annotation.data === "object"
    )
  ) {
    throw new Error("Client sent invalid annotation. Missing data and type");
  }
  return { type: annotation.type, data: annotation.data };
}
