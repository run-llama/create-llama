import {
  ChatMessage,
  ContentPosition,
  getSourceAnnotationData,
  useChatMessage,
} from "@llamaindex/chat-ui";
import { ToolAnnotations } from "./chat-tools";
import { Markdown } from "./widgets/Markdown";

export function ChatMessageContent() {
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
  return <ChatMessage.Content content={customContent} />;
}
