import { WorkflowEvent } from "@llamaindex/core/workflow";
import { EngineResponse } from "llamaindex";

export type AgentInput = {
  message: string;
  streaming?: boolean;
};

export class AgentRunEvent extends WorkflowEvent<{
  name: string;
  msg: string;
}> {}

export class AgentRunResult {
  constructor(public response: AsyncGenerator<WorkflowEvent>) {}
}

export class FunctionCallingStreamResult {
  constructor(public response: ReadableStream<EngineResponse>) {}
}
