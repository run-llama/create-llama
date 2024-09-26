import { WorkflowEvent } from "@llamaindex/core/workflow";

export type AgentInput = {
  message: string;
  streaming?: boolean;
};

export class AgentRunEvent extends WorkflowEvent<{
  name: string;
  msg: string;
}> {}
