"use client";

import { useEffect, useMemo, useState } from "react";

export interface ChatConfig {
  backend?: string;
  starterQuestions?: string[];
}

export function useClientConfig(
  opts: { shouldFetch?: boolean } = { shouldFetch: false },
): ChatConfig {
  const [config, setConfig] = useState<ChatConfig>();

  const backendOrigin = useMemo(() => {
    const chatAPI = process.env.NEXT_PUBLIC_CHAT_API;
    if (chatAPI) {
      return new URL(chatAPI).origin;
    } else {
      if (typeof window !== "undefined") {
        // Use BASE_URL from window.ENV
        return (window as any).ENV?.BASE_URL || "";
      }
      return "";
    }
  }, []);

  useEffect(() => {
    if (opts.shouldFetch) {
      const backend = backendOrigin;
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
  }, [backendOrigin, opts.shouldFetch]);

  return config || { backend: backendOrigin };
}
