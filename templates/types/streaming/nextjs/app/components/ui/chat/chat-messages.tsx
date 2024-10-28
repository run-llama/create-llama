"use client";

import { ChatMessage, ChatMessages, useChatUI } from "@llamaindex/chat-ui";
import { useEffect, useState } from "react";
import { Button } from "../button";
import ChatMessageAvatar from "./chat-message/chat-avatar";
import { useClientConfig } from "./hooks/use-config";

export default function CustomChatMessages() {
  const { messages } = useChatUI();
  return (
    <ChatMessages className="shadow-xl rounded-xl">
      <ChatMessages.List>
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message}>
            <ChatMessageAvatar />
            <ChatMessage.Content />
            {/* TODO: handle ChatMessage content and artifact */}
            <ChatMessage.Actions />
          </ChatMessage>
        ))}
        <ChatMessages.Loading />
      </ChatMessages.List>
      <ChatMessages.Actions />
      <StarterQuestions />
    </ChatMessages>
  );
}

function StarterQuestions() {
  const { backend } = useClientConfig();
  const { append } = useChatUI();
  const [starterQuestions, setStarterQuestions] = useState<string[]>();

  useEffect(() => {
    if (!starterQuestions) {
      fetch(`${backend}/api/chat/config`)
        .then((response) => response.json())
        .then((data) => {
          if (data?.starterQuestions) {
            setStarterQuestions(data.starterQuestions);
          }
        })
        .catch((error) => console.error("Error fetching config", error));
    }
  }, [starterQuestions, backend]);

  if (!starterQuestions?.length) return null;

  return (
    <div className="absolute bottom-6 left-0 w-full">
      <div className="grid grid-cols-2 gap-2 mx-20">
        {starterQuestions.map((question, i) => (
          <Button
            key={i}
            variant="outline"
            onClick={() => append({ role: "user", content: question })}
          >
            {question}
          </Button>
        ))}
      </div>
    </div>
  );
}
