import {
  ChatMessage,
  ContentPosition,
  getAnnotationData,
  Message,
  MessageAnnotation,
  useChatMessage,
} from "@llamaindex/chat-ui";
import { JSONValue } from "ai";
import ChatTools from "./chat-tools";

export function ChatMessageContent() {
  const { message } = useChatMessage();
  const customContent = [
    {
      position: ContentPosition.AFTER_EVENTS,
      component: <ToolAnnotations message={message} />,
    },
  ];
  return <ChatMessage.Content content={customContent} />;
}

type ToolData = {
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

function ToolAnnotations({ message }: { message: Message }) {
  const annotations = message.annotations as MessageAnnotation[] | undefined;
  const toolData = annotations
    ? (getAnnotationData(annotations, "tools") as unknown as ToolData[])
    : null;
  return toolData?.[0] ? <ChatTools data={toolData[0]} /> : null;
}
