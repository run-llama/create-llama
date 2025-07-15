import type { Workflow } from "@llamaindex/workflow";
import type next from "next";

/**
 * A factory function that creates a Workflow instance, possibly asynchronously.
 * The requestBody parameter is the body from the request, which can be used to customize the workflow per request.
 */
export type WorkflowFactory = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestBody?: any,
) => Promise<Workflow> | Workflow;

export type NextAppOptions = Parameters<typeof next>[0];

export type LlamaDeployConfig = {
  deployment: string;
  workflow: string;
};

export type UIConfig = {
  starterQuestions?: string[];
  componentsDir?: string;
  layoutDir?: string;
  devMode?: boolean;
  enableFileUpload?: boolean;
  llamaDeploy?: LlamaDeployConfig;
  serverUrl?: string;
};

export type LlamaCloudConfig = {
  outputDir: string;
  indexSelector?: boolean;
};

export type LlamaIndexServerOptions = NextAppOptions & {
  workflow?: WorkflowFactory;
  uiConfig?: UIConfig;
  fileServer?: string;
  suggestNextQuestions?: boolean;
  llamaCloud?: LlamaCloudConfig;
};
