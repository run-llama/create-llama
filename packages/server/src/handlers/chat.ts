import type { AgentInputData } from "@llamaindex/workflow";
import { type Message } from "ai";
import { IncomingMessage, ServerResponse } from "http";
import type { MessageType } from "llamaindex";
import { type WorkflowFactory } from "../types";
import {
  parseRequestBody,
  pipeStreamToResponse,
  sendJSONResponse,
} from "../utils/request";
import { runWorkflow } from "../utils/workflow";

export const handleChat = async (
  req: IncomingMessage,
  res: ServerResponse,
  workflowFactory: WorkflowFactory,
) => {
  try {
    const body = await parseRequestBody(req);
    const { messages } = body as { messages: Message[] };

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== "user") {
      return sendJSONResponse(res, 400, {
        error: "Messages cannot be empty and last message must be from user",
      });
    }
    const workflowInput: AgentInputData = {
      userInput: lastMessage.content,
      chatHistory: messages.map((message) => ({
        role: message.role as MessageType,
        content: message.content,
      })),
    };

    const workflow = await workflowFactory(body);

    const stream = await runWorkflow(workflow, workflowInput);

    pipeStreamToResponse(res, stream);
  } catch (error) {
    console.error("Chat error:", error);
    return sendJSONResponse(res, 500, {
      detail: (error as Error).message || "Internal server error",
    });
  }
};
