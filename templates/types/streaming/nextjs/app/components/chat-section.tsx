"use client";

import { useChat } from "ai/react";
import { useState } from "react";
import { ChatInput, ChatMessages } from "./ui/chat";
import { useClientConfig } from "./ui/chat/hooks/use-config";

export default function ChatSection() {
  const { backend } = useClientConfig();
  const [requestData, setRequestData] = useState<any>();
  const {
    messages,
    input,
    isLoading,
    handleSubmit,
    handleInputChange,
    reload,
    stop,
    append,
    setInput,
  } = useChat({
    body: { data: requestData },
    api: `${backend}/api/chat`,
    headers: {
      "Content-Type": "application/json", // using JSON because of vercel/ai 2.2.26
    },
    onError: (error: unknown) => {
      if (!(error instanceof Error)) throw error;
      const message = JSON.parse(error.message);
      alert(message.detail);
    },
    sendExtraMessageFields: true,
  });

  return (
    <div className="space-y-4 w-full h-full flex flex-col">
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        reload={reload}
        stop={stop}
        append={append}
      />
      <ChatInput
        input={input}
        handleSubmit={handleSubmit}
        handleInputChange={handleInputChange}
        isLoading={isLoading}
        messages={messages}
        append={append}
        setInput={setInput}
        requestParams={{ params: requestData }}
        setRequestData={setRequestData}
      />
    </div>
  );
}
