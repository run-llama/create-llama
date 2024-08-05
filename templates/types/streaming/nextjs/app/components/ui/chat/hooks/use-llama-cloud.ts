"use client";

import { useEffect, useState } from "react";
import { useClientConfig } from "./use-config";

export type LLamaCloudProject = {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
  pipelines: Array<{
    id: string;
    name: string;
  }>;
};

export type PipelineConfig = {
  project: string; // project name
  pipeline: string; // pipeline name
};

export type LlamaCloudConfig = {
  projects?: LLamaCloudProject[];
  pipeline?: PipelineConfig;
};

export function useLlamaCloud() {
  const { backend } = useClientConfig();
  const [config, setConfig] = useState<LlamaCloudConfig>();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_LLAMACLOUD === "true" && !config) {
      fetch(`${backend}/api/chat/config/llamacloud`)
        .then((response) => response.json())
        .then((data) => setConfig(data))
        .catch((error) => console.error("Error fetching config", error));
    }
  }, [backend, config, isUsingLLamaCloud]);

  const setPipeline = (pipelineConfig?: PipelineConfig) => {
    setConfig({ ...config, pipeline: pipelineConfig });
  };

  return {
    projects: config?.projects ?? [],
    pipeline: config?.pipeline,
    setPipeline,
  };
}
