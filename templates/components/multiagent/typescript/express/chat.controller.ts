import { Message, StreamingTextResponse } from "ai";
import { Request, Response } from "express";
import {
  convertToChatHistory,
  retrieveMessageContent,
} from "./llamaindex/streaming/annotations";
import { createWorkflow } from "./workflow/factory";
import { createStreamFromWorkflowContext } from "./workflow/stream";

export const chat = async (req: Request, res: Response) => {
  try {
    const { messages, data }: { messages: Message[]; data?: any } = req.body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error:
          "messages are required in the request body and the last message must be from the user",
      });
    }
    const chatHistory = convertToChatHistory(messages);
    const userMessageContent = retrieveMessageContent(messages);

    const workflow = await createWorkflow({ chatHistory });

    const context = workflow.run({
      message: userMessageContent,
      streaming: true,
    });

    const { stream, dataStream } =
      await createStreamFromWorkflowContext(context);

    return new StreamingTextResponse(stream, {}, dataStream);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: (error as Error).message,
    });
  }
};
