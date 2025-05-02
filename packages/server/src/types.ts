import {
  type AgentWorkflow,
  type ChatMessage,
  type Workflow,
  workflowEvent,
  WorkflowStream,
} from "llamaindex";
import type next from "next";

export type WorkflowInput = {
  userInput: string;
  chatHistory: ChatMessage[];
};
export const workflowInputEvent = workflowEvent<WorkflowInput>();
export const workflowOutputEvent = workflowEvent<WorkflowStream>();
/**
 * ServerWorkflow can be either a custom Workflow or an AgentWorkflow
 */
export type ServerWorkflow = Workflow | AgentWorkflow;

/**
 * A factory function that creates a ServerWorkflow instance, possibly asynchronously.
 * The requestBody parameter is the body from the request, which can be used to customize the workflow per request.
 */
export type WorkflowFactory = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestBody?: any,
) => Promise<ServerWorkflow> | ServerWorkflow;

export type NextAppOptions = Parameters<typeof next>[0];

export type UIConfig = {
  appTitle?: string;
  starterQuestions?: string[];
  componentsDir?: string;
  llamaCloudIndexSelector?: boolean;
};

export type LlamaIndexServerOptions = NextAppOptions & {
  workflow: WorkflowFactory;
  uiConfig?: UIConfig;
};
