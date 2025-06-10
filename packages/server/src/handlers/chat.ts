import type { AgentInputData, WorkflowContext } from "@llamaindex/workflow";
import { type Message } from "ai";
import { IncomingMessage, ServerResponse } from "http";
import type { MessageType } from "llamaindex";
import { type WorkflowFactory } from "../types";
import {
  getHumanResponsesFromMessage,
  pauseForHumanInput,
  resumeWorkflowFromHumanResponses,
} from "../utils/hitl";
import {
  parseRequestBody,
  pipeStreamToResponse,
  sendJSONResponse,
} from "../utils/request";
import { toDataStream } from "../utils/stream";
import { sendSuggestedQuestionsEvent } from "../utils/suggestion";
import { runWorkflow } from "../utils/workflow";

export const handleChat = async (
  req: IncomingMessage,
  res: ServerResponse,
  workflowFactory: WorkflowFactory,
  suggestNextQuestions: boolean,
) => {
  try {
    // const requestId = req.headers["x-request-id"] as string; // TODO: update for chat route also
    const requestId = "test-request-id"; // FIXME: remove this

    const body = await parseRequestBody(req);
    const { messages } = body as { messages: Message[] };
    const chatHistory = messages.map((message) => ({
      role: message.role as MessageType,
      content: message.content,
    }));

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== "user") {
      return sendJSONResponse(res, 400, {
        error: "Messages cannot be empty and last message must be from user",
      });
    }
    const workflowInput: AgentInputData = {
      userInput: lastMessage.content,
      chatHistory,
    };

    const abortController = new AbortController();
    res.on("close", () => abortController.abort("Connection closed"));

    const workflow = await workflowFactory(body);
    let context: WorkflowContext;

    // if there is human response, we need to resume the workflow from the human response
    // otherwise, we can start with empty context
    const humanResponses = getHumanResponsesFromMessage(lastMessage);
    if (humanResponses.length > 0) {
      context = await resumeWorkflowFromHumanResponses(
        workflow,
        humanResponses,
        requestId,
      );
    } else {
      context = workflow.createContext();
    }

    const workflowEventStream = await runWorkflow(
      context,
      workflowInput,
      abortController.signal,
    );

    const dataStream = toDataStream(workflowEventStream, {
      callbacks: {
        onPauseForHumanInput: () => pauseForHumanInput(context, requestId),
        onFinal: async (completion, dataStreamWriter) => {
          chatHistory.push({
            role: "assistant" as MessageType,
            content: completion,
          });
          if (suggestNextQuestions) {
            await sendSuggestedQuestionsEvent(dataStreamWriter, chatHistory);
          }
        },
      },
    });
    pipeStreamToResponse(res, dataStream);
  } catch (error) {
    console.error("Chat handler error:", error);
    return sendJSONResponse(res, 500, {
      detail: (error as Error).message || "Internal server error",
    });
  }
};
