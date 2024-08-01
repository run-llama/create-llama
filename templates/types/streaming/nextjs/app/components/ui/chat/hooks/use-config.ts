"use client";

import { useEffect, useMemo, useState } from "react";

export interface LLamaCloudPipeline {
  id: string;
  name: string;
  project_id: string;
}

export interface LLamaCloudProject {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  pipelines: LLamaCloudPipeline[];
}

export interface LlamaCloudConfig {
  project: string; // project name
  pipeline: string; // pipeline name
}

export interface ChatConfig {
  backend?: string;
  starterQuestions?: string[];
  llamaCloud?: {
    projects: LLamaCloudProject[];
    config?: LlamaCloudConfig;
  };
  updateLlamaCloudConfig: (config: LlamaCloudConfig) => Promise<void>;
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

  const updateLlamaCloudConfig = async (config: LlamaCloudConfig) => {
    const response = await fetch(configAPI, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    });
    if (!response.ok) {
      throw new Error("Failed to update LlamaCloud config");
    }
  };

  return {
    backend: backendOrigin,
    starterQuestions: config?.starterQuestions,
    llamaCloud: config?.llamaCloud,
    updateLlamaCloudConfig,
  };
}
