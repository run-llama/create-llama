import {
  ChatMessage,
  ContentPosition,
  useChatMessage,
} from "@llamaindex/chat-ui";
import { ToolAnnotations } from "./chat-tools";
import { Markdown } from "./widgets/Markdown";

export function ChatMessageContent() {
  const { message } = useChatMessage();
  const customContent = [
    {
      position: ContentPosition.AFTER_EVENTS,
      component: <ToolAnnotations message={message} />,
    },
  ];
  return (
    <ChatMessage.Content content={customContent} markdownComponent={Markdown} />
  );
}
