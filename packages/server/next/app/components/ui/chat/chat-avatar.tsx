"use client";

import { ChatMessage } from "@llamaindex/chat-ui";

export function ChatMessageAvatar() {
  return (
    <ChatMessage.Avatar>
      <img
        className="rounded-full border-1 border-[#e711dd]"
        src="/llama.png"
        alt="Llama Logo"
      />
    </ChatMessage.Avatar>
  );
}
