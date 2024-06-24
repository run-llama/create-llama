"use client";

import { useEffect, useMemo, useState } from "react";

export interface ChatConfig {
  chatAPI?: string;
  embedAPI?: string;
  starterQuestions?: string[];
}

export function useClientConfig(): ChatConfig {
  const chatAPI = process.env.NEXT_PUBLIC_CHAT_API;
  const [config, setConfig] = useState<ChatConfig>({
    chatAPI,
  });

  const backendOrigin = useMemo(() => {
    return chatAPI ? new URL(chatAPI).origin : "";
  }, [chatAPI]);

  const configAPI = `${backendOrigin}/api/chat/config`;
  const embedAPI = `${backendOrigin}/api/chat/embed`;

  useEffect(() => {
    fetch(configAPI)
      .then((response) => response.json())
      .then((data) => setConfig({ ...data, chatAPI }))
      .catch((error) => console.error("Error fetching config", error));
  }, [chatAPI, configAPI]);

  return {
    chatAPI,
    embedAPI,
    starterQuestions: config.starterQuestions,
  };
}
