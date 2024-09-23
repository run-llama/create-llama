import { WorkflowEvent } from "@llamaindex/core/workflow";
import { ChatResponseChunk } from "llamaindex";

export type AgentInput = {
  message: string;
  streaming?: boolean;
};

export class AgentRunEvent extends WorkflowEvent<{
  name: string;
  msg: string;
}> {}

export class AgentRunResult {
  constructor(
    public response: AsyncGenerator<ChatResponseChunk, any, unknown>,
  ) {}
}
