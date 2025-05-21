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

export type UIConfig = {
  appTitle?: string;
  starterQuestions?: string[];
  componentsDir?: string;
  llamaCloudIndexSelector?: boolean;
  devMode?: boolean;
};

export type LlamaIndexServerOptions = NextAppOptions & {
  workflow: WorkflowFactory;
  uiConfig?: UIConfig;
  suggestNextQuestions?: boolean;
};
