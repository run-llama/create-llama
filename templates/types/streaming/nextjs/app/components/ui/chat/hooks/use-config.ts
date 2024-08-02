"use client";

import { useEffect, useMemo, useState } from "react";

export interface LLamaCloudProject {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  pipelines: Array<{
    id: string;
    name: string;
  }>;
}

export interface ChatConfig {
  backend?: string;
  starterQuestions?: string[];
  llamaCloud?: {
    projects: LLamaCloudProject[];
  };
}

export function useClientConfig(opts?: {
  shouldFetchConfig: boolean;
}): ChatConfig {
  const chatAPI = process.env.NEXT_PUBLIC_CHAT_API;
  const [config, setConfig] = useState<ChatConfig>();

  const backendOrigin = useMemo(() => {
    return chatAPI ? new URL(chatAPI).origin : "";
  }, [chatAPI]);

  const configAPI = `${backendOrigin}/api/chat/config`;

  // control whether to call the config API to reduce unnecessary requests
  const shouldFetchConfig = opts?.shouldFetchConfig ?? false;

  useEffect(() => {
    if (shouldFetchConfig) {
      fetch(configAPI)
        .then((response) => response.json())
        .then((data) => setConfig({ ...data, chatAPI }))
        .catch((error) => console.error("Error fetching config", error));
    }
  }, [chatAPI, configAPI, shouldFetchConfig]);

  return {
    backend: backendOrigin,
    starterQuestions: config?.starterQuestions,
    llamaCloud: config?.llamaCloud,
  };
}
