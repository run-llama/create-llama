import { JSONValue, Message } from "ai";
import ChatInput from "./chat-input";
import ChatMessages from "./chat-messages";

export { type ChatHandler } from "./chat.interface";
export { ChatInput, ChatMessages };

export enum MessageAnnotationType {
  CSV = "csv",
  IMAGE = "image",
  SOURCES = "sources",
  EVENTS = "events",
  TOOLS = "tools",
}

export type ImageData = {
  url: string;
};

export type CsvData = {
  content: string;
  filename: string;
  filesize: number;
};

export type SourceNode = {
  id: string;
  metadata: Record<string, unknown>;
  score?: number;
  text: string;
};

export type SourceData = {
  nodes: SourceNode[];
};

export type EventData = {
  title: string;
  isCollapsed: boolean;
};

export type ToolData = {
  toolCall: {
    id: string;
    name: string;
    input: {
      [key: string]: JSONValue;
    };
  };
  toolOutput: {
    output: JSONValue;
    isError: boolean;
  };
};

export type AnnotationData =
  | ImageData
  | CsvData
  | SourceData
  | EventData
  | ToolData;

export type MessageAnnotation = {
  type: MessageAnnotationType;
  data: AnnotationData;
};

export function getAnnotationData<T extends AnnotationData>(
  annotations: MessageAnnotation[],
  type: MessageAnnotationType,
): T[] {
  return annotations.filter((a) => a.type === type).map((a) => a.data as T);
}

// this function is used to get the additional resources for a message
// it filters the annotations of a message and returns the unique resources
// currently only CSV resources are supported
export const getInputResources = (
  messages: Message[],
): {
  csv: Array<CsvData>;
} => {
  const csvResources: CsvData[] = [];
  messages.forEach((message) => {
    if (message.annotations) {
      const csvData = getAnnotationData<CsvData>(
        message.annotations as MessageAnnotation[],
        MessageAnnotationType.CSV,
      );
      csvData.forEach((data) => {
        if (
          csvResources.findIndex((r) => r.filename === data.filename) === -1
        ) {
          csvResources.push(data);
        }
      });
    }
  });
  return {
    csv: csvResources,
  };
};
