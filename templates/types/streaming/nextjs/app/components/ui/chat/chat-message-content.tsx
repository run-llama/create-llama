import {
  ChatMessage,
  ContentPosition,
  useChatMessage,
} from "@llamaindex/chat-ui";
import {ChatMarkdown} from "./chat-markdown";
import { ToolAnnotations } from "./chat-tools";

export function ChatMessageContent() {
  const { message } = useChatMessage();
  const customContent = [
    {
      position: ContentPosition.AFTER_EVENTS,
      component: <ToolAnnotations message={message} />,
    },
  ];
  return (
    <ChatMessage.Content
      content={customContent}
      markdownComponent={ChatMarkdown}
    />
  );
}
