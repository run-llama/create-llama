import { JSONValue } from "ai";
import { MessageContent, MessageContentDetail } from "llamaindex";

export type DocumentFileType = "csv" | "pdf" | "txt" | "docx";

export type DocumentFileContent = {
  type: "ref" | "text";
  value: string[] | string;
};

export type DocumentFile = {
  id: string;
  filename: string;
  filesize: number;
  filetype: DocumentFileType;
  content: DocumentFileContent;
};

type Annotation = {
  type: string;
  data: object;
};

export function retrieveDocumentIds(annotations?: JSONValue[]): string[] {
  if (!annotations) return [];

  const ids: string[] = [];

  for (const annotation of annotations) {
    const { type, data } = getValidAnnotation(annotation);
    if (
      type === "document_file" &&
      "files" in data &&
      Array.isArray(data.files)
    ) {
      const files = data.files as DocumentFile[];
      for (const file of files) {
        if (Array.isArray(file.content.value)) {
          // it's an array, so it's an array of doc IDs
          for (const id of file.content.value) {
            ids.push(id);
          }
        }
      }
    }
  }

  return ids;
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
      const csvFiles: DocumentFile[] = data.files.filter(
        (file: DocumentFile) => file.filetype === "csv",
      );
      if (csvFiles && csvFiles.length > 0) {
        const csvContents = csvFiles.map((file: DocumentFile) => {
          const fileContent = Array.isArray(file.content.value)
            ? file.content.value.join("\n")
            : file.content.value;
          return "```csv\n" + fileContent + "\n```";
        });
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
