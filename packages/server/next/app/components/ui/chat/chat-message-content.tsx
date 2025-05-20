"use client";

import { ChatMessage, useChatMessage } from "@llamaindex/chat-ui";
import { DynamicEvents } from "./custom/events/dynamic-events";
import { HumanResponse } from "./custom/events/human-response";
import { ComponentDef } from "./custom/events/types";
import { ToolAnnotations } from "./tools/chat-tools";

export function ChatMessageContent({
  componentDefs,
  appendError,
}: {
  componentDefs: ComponentDef[];
  appendError: (error: string) => void;
}) {
  const { message } = useChatMessage();

  return (
    <ChatMessage.Content>
      <ChatMessage.Content.Event />
      <ChatMessage.Content.AgentEvent />
      <ToolAnnotations />
      <ChatMessage.Content.Image />
      <DynamicEvents componentDefs={componentDefs} appendError={appendError} />
      <ChatMessage.Content.Artifact />
      <ChatMessage.Content.Markdown />
      <ChatMessage.Content.DocumentFile />
      <ChatMessage.Content.Source />
      <ChatMessage.Content.SuggestedQuestions />
      <HumanResponse events={message.annotations || []} />
    </ChatMessage.Content>
  );
}
