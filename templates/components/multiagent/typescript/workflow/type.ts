import { WorkflowEvent } from "@llamaindex/workflow";
import { MessageContent } from "llamaindex";

export type AgentInput = {
  message: string | MessageContent;
  streaming?: boolean;
};

export type AgentRunEventType = "text" | "progress";

export type ProgressEventData = {
  id: string;
  total: number;
  current: number;
};

export type AgentRunEventData = ProgressEventData;

export class AgentRunEvent extends WorkflowEvent<{
  name: string;
  text: string;
  type: AgentRunEventType;
  data?: AgentRunEventData;
}> {
  constructor(options: {
    name: string;
    text: string;
    type?: AgentRunEventType;
    data?: AgentRunEventData;
  }) {
    super({
      ...options,
      type: options.type || "text",
    });
  }
}
