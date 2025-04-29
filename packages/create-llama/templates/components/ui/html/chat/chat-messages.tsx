"use client";

import { useEffect, useRef } from "react";
import ChatItem from "./chat-item";

export interface Message {
  id: string;
  content: string;
  role: string;
}

export default function ChatMessages({
  messages,
  isLoading,
  reload,
  stop,
}: {
  messages: Message[];
  isLoading?: boolean;
  stop?: () => void;
  reload?: () => void;
  append?: (
    message: Message | Omit<Message, "id">,
  ) => Promise<string | null | undefined>;
}) {
  const scrollableChatContainerRef = useRef<HTMLDivElement>(null);
  const lastMessage = messages[messages.length - 1];

  const scrollToBottom = () => {
    if (scrollableChatContainerRef.current) {
      scrollableChatContainerRef.current.scrollTop =
        scrollableChatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, lastMessage]);

  return (
    <div
      className="w-full max-w-5xl flex-1 overflow-auto rounded-xl bg-white p-4 shadow-xl"
      ref={scrollableChatContainerRef}
    >
      <div className="flex flex-col gap-5 divide-y">
        {messages.map((m: Message) => (
          <ChatItem key={m.id} {...m} />
        ))}
      </div>
    </div>
  );
}
