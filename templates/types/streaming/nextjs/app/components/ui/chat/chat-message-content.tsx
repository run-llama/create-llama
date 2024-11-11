import {
  ChatMessage,
  ContentPosition,
  getSourceAnnotationData,
  useChatMessage,
  useChatUI,
} from "@llamaindex/chat-ui";
import { Markdown } from "./custom/markdown";
import { ToolAnnotations } from "./tools/chat-tools";

export function ChatMessageContent() {
  const { isLoading, append } = useChatUI();
  const { message } = useChatMessage();
  const customContent = [
    {
      // override the default markdown component
      position: ContentPosition.MARKDOWN,
      component: (
        <Markdown
          content={message.content}
          sources={getSourceAnnotationData(message.annotations)?.[0]}
        />
      ),
    },
    {
      // add the tool annotations after events
      position: ContentPosition.AFTER_EVENTS,
      component: <ToolAnnotations message={message} />,
    },
  ];
  return (
    <ChatMessage.Content
      content={customContent}
      isLoading={isLoading}
      append={append}
    />
  );
}
