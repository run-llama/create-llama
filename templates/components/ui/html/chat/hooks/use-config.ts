"use client";

import { useEffect, useState } from "react";

export interface ChatConfig {
  backend?: string;
  starterQuestions?: string[];
}

const getBackendOrigin = () => {
  const chatAPI = process.env.NEXT_PUBLIC_CHAT_API;
  return chatAPI ? new URL(chatAPI).origin : "";
};

export function useClientConfig(
  opts: { shouldFetch?: boolean } = { shouldFetch: false },
): ChatConfig {
  const [config, setConfig] = useState<ChatConfig>();

  useEffect(() => {
    if (opts.shouldFetch) {
      const backend = getBackendOrigin();
      const configAPI = `${backend}/api/chat/config`;
      fetch(configAPI)
        .then((response) => response.json())
        .then((data) =>
          setConfig({
            backend,
            starterQuestions: data?.starterQuestions,
          }),
        )
        .catch((error) => console.error("Error fetching config", error));
    }
  }, [opts.shouldFetch]);

  return config || { backend: getBackendOrigin() };
}
