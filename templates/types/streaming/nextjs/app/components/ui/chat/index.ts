import ChatInput from "./chat-input";
import ChatMessages from "./chat-messages";

export { type ChatHandler } from "./chat.interface";
export { ChatInput, ChatMessages };

export enum MessageAnotationType {
  IMAGE = "image",
  SOURCES = "sources",
}

export type ImageData = {
  url: string;
};

export type SourceNode = {
  id: string;
  medadata: Record<string, unknown>;
  score: number;
  text: string;
};

export type SourceData = {
  nodes: SourceNode[];
};

export type AnnotationData = ImageData | SourceData;

export type MessageAnotation = {
  type: MessageAnotationType;
  data: AnnotationData;
};
