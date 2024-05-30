"use client";

import { useEffect, useMemo, useState } from "react";

export interface ChatConfig {
  starterQuestions?: string[];
}

export function useConfig() {
  const API_ROUTE = "/api/config";
  const [config, setConfig] = useState<ChatConfig>({});

  const configAPI = useMemo(() => {
    const chatAPI = process.env.NEXT_PUBLIC_CHAT_API;
    const backendOrigin = chatAPI ? new URL(chatAPI).origin : "";
    return `${backendOrigin}${API_ROUTE}`;
  }, []);

  useEffect(() => {
    fetch(configAPI)
      .then((response) => response.json())
      .then((data) => setConfig(data))
      .catch((error) => console.error("Error fetching config", error));
  }, [configAPI]);

  return config;
}
