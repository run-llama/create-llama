"use client";

import { ChatMessage, ChatMessages, useChatUI } from "@llamaindex/chat-ui";
import { useEffect, useMemo, useState } from "react";
import { ToolData } from ".";
import { Button } from "../button";
import { ChatMessageContent } from "./chat-message";
import ChatMessageAvatar from "./chat-message/chat-avatar";
import { useClientConfig } from "./hooks/use-config";

export default function CustomChatMessages() {
  const { messages, isLoading, append } = useChatUI();

  // build a map of message id to artifact version
  const artifactVersionMap = useMemo(() => {
    const map = new Map<string, number | undefined>();
    let versionIndex = 1;
    messages.forEach((m) => {
      m.annotations?.forEach((annotation: any) => {
        if (
          typeof annotation === "object" &&
          annotation != null &&
          "type" in annotation &&
          annotation.type === "tools"
        ) {
          const data = annotation.data as ToolData;
          if (data?.toolCall?.name === "artifact") {
            map.set(m.id, versionIndex);
            versionIndex++;
          }
        }
      });
    });
    return map;
  }, [messages]);

  return (
    <ChatMessages className="shadow-xl rounded-xl">
      <ChatMessages.List>
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message}>
            <ChatMessageAvatar />
            <ChatMessageContent
              message={message}
              isLoading={isLoading}
              append={append}
              isLastMessage={message === messages[messages.length - 1]}
              artifactVersion={artifactVersionMap.get(message.id)}
            />
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
