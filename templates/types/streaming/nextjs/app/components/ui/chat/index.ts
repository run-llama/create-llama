import ChatInput from "./chat-input";
import ChatMessages from "./chat-messages";

export { type ChatHandler } from "./chat.interface";
export { ChatInput, ChatMessages };

export enum MessageAnotationType {
  IMAGE = "image",
  DOCUMENT = "document",
}

export type ImageData = {
  url: string;
};

export type DocumentNode = {
  id: string;
  medadata: Record<string, unknown>;
  score: number;
  text: string;
};

export type DocumentData = {
  nodes: DocumentNode[];
};

export type AnnotationData = ImageData | DocumentData;

export type MessageAnotation = {
  type: MessageAnotationType;
  data: AnnotationData;
};
