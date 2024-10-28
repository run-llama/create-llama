"use client";

import {
  ChatInput,
  ChatMessage,
  ChatMessages,
  ChatSection as ChatSectionUI,
  useChatUI,
} from "@llamaindex/chat-ui";
import { useChat } from "ai/react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import ChatMessageAvatar from "./ui/chat/chat-message/chat-avatar";
import { useClientConfig } from "./ui/chat/hooks/use-config";
import { LlamaCloudSelector } from "./ui/chat/widgets/LlamaCloudSelector";

export default function ChatSection() {
  const { backend } = useClientConfig();
  const handler = useChat({
    api: `${backend}/api/chat`,
    onError: (error: unknown) => {
      if (!(error instanceof Error)) throw error;
      alert(JSON.parse(error.message).detail);
    },
  });
  return (
    <ChatSectionUI handler={handler} className="w-full h-full">
      <ChatMessages className="shadow-xl rounded-xl">
        <ChatMessages.List>
          {handler.messages.map((message) => (
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
      <ChatInput className="shadow-xl rounded-xl">
        {/* TODO: Refactor file components for display uploaded files */}
        <ChatInput.Preview />
        <ChatInput.Form>
          <ChatInput.Field />
          {/* TODO: handle upload file  */}
          <ChatInput.Upload />
          <LlamaCloudSelector />
          <ChatInput.Submit />
        </ChatInput.Form>
      </ChatInput>
    </ChatSectionUI>
  );
}

// TODO: extract a component or move to CustomChatMessages
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
