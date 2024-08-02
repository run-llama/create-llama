"use client";

import { useState } from "react";
import { useClientConfig } from "./use-config";

export interface PipelineConfig {
  project: string; // project name
  pipeline: string; // pipeline name
}

export function useLlamaCloud() {
  const { llamaCloud } = useClientConfig({ shouldFetchConfig: true });
  const [pipeline, setPipeline] = useState<PipelineConfig>();

  return {
    projects: llamaCloud?.projects ?? [],
    pipeline,
    setPipeline,
  };
}
