import { JSONValue, Message } from "ai";
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

export function isValidMessages(messages: Message[]): boolean {
  const lastMessage =
    messages && messages.length > 0 ? messages[messages.length - 1] : null;
  return lastMessage !== null && lastMessage.role === "user";
}

export function retrieveDocumentIds(messages: Message[]): string[] {
  // retrieve document Ids from the annotations of all messages (if any)
  const annotations = getAllAnnotations(messages);
  if (annotations.length === 0) return [];

  const ids: string[] = [];

  for (const { type, data } of annotations) {
    if (
      type === "document_file" &&
      "files" in data &&
      Array.isArray(data.files)
    ) {
      const files = data.files as DocumentFile[];
      for (const file of files) {
        if (Array.isArray(file.content.value)) {
          // it's an array, so it's an array of doc IDs
          ids.push(...file.content.value);
        }
      }
    }
  }

  return ids;
}

export function retrieveMessageContent(messages: Message[]): MessageContent {
  const userMessage = messages[messages.length - 1];
  return [
    {
      type: "text",
      text: userMessage.content,
    },
    ...retrieveLatestArtifact(messages),
    ...convertAnnotations(messages),
  ];
}

function getAllAnnotations(messages: Message[]): Annotation[] {
  return messages.flatMap((message) =>
    (message.annotations ?? []).map((annotation) =>
      getValidAnnotation(annotation),
    ),
  );
}

// get latest artifact from annotations to append to the user message
function retrieveLatestArtifact(messages: Message[]): MessageContentDetail[] {
  const annotations = getAllAnnotations(messages);
  if (annotations.length === 0) return [];

  for (const { type, data } of annotations.reverse()) {
    if (
      type === "tools" &&
      "toolCall" in data &&
      "toolOutput" in data &&
      typeof data.toolCall === "object" &&
      typeof data.toolOutput === "object" &&
      data.toolCall !== null &&
      data.toolOutput !== null &&
      "name" in data.toolCall &&
      data.toolCall.name === "artifact"
    ) {
      const toolOutput = data.toolOutput as { output?: { code?: string } };
      if (toolOutput.output?.code) {
        return [
          {
            type: "text",
            text: `The existing code is:\n\`\`\`\n${toolOutput.output.code}\n\`\`\``,
          },
        ];
      }
    }
  }
  return [];
}

function convertAnnotations(messages: Message[]): MessageContentDetail[] {
  // annotations from the last user message that has annotations
  const annotations: Annotation[] =
    messages
      .slice()
      .reverse()
      .find((message) => message.role === "user" && message.annotations)
      ?.annotations?.map(getValidAnnotation) || [];
  if (annotations.length === 0) return [];

  const content: MessageContentDetail[] = [];
  annotations.forEach(({ type, data }) => {
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
