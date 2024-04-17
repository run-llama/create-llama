import ChatInput from "./chat-input";
import ChatMessages from "./chat-messages";

export { type ChatHandler } from "./chat.interface";
export { ChatInput, ChatMessages };

export enum MessageAnnotationType {
  IMAGE = "image",
  SOURCES = "sources",
  EVENTS = "events",
}

export type ImageData = {
  url: string;
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

export type AnnotationData = ImageData | SourceData | EventData;

export type MessageAnnotation = {
  type: MessageAnnotationType;
  data: AnnotationData;
};
