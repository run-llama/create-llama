"use client";

import { useEffect, useMemo, useState } from "react";

export interface LLamaCloudProject {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
}

export interface LLamaCloudPipeline {
  id: string;
  name: string;
  project_id: string;
}

export interface ChatConfig {
  backend?: string;
  starterQuestions?: string[];
  llamaCloud?: {
    projects: Array<
      LLamaCloudProject & {
        pipelines: LLamaCloudPipeline[];
      }
    >;
  };
}

export function useClientConfig(): ChatConfig {
  const chatAPI = process.env.NEXT_PUBLIC_CHAT_API;
  const [config, setConfig] = useState<ChatConfig>();

  const backendOrigin = useMemo(() => {
    return chatAPI ? new URL(chatAPI).origin : "";
  }, [chatAPI]);

  const configAPI = `${backendOrigin}/api/chat/config`;

  useEffect(() => {
    fetch(configAPI)
      .then((response) => response.json())
      .then((data) => setConfig({ ...data, chatAPI }))
      .catch((error) => console.error("Error fetching config", error));
  }, [chatAPI, configAPI]);

  return {
    backend: backendOrigin,
    starterQuestions: config?.starterQuestions,
    llamaCloud: config?.llamaCloud,
  };
}
