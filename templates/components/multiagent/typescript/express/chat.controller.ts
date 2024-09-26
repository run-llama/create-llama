import { StopEvent } from "@llamaindex/core/workflow";
import { Message, streamToResponse } from "ai";
import { Request, Response } from "express";
import { ChatMessage, ChatResponseChunk } from "llamaindex";
import { createWorkflow } from "./workflow/factory";
import { toDataStream, workflowEventsToStreamData } from "./workflow/stream";

export const chat = async (req: Request, res: Response) => {
  try {
    const { messages }: { messages: Message[] } = req.body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error:
          "messages are required in the request body and the last message must be from the user",
      });
    }

    const chatHistory = messages as ChatMessage[];
    const agent = createWorkflow(chatHistory);
    const result = agent.run<AsyncGenerator<ChatResponseChunk>>(
      userMessage.content,
    ) as unknown as Promise<StopEvent<AsyncGenerator<ChatResponseChunk>>>;

    // convert the workflow events to a vercel AI stream data object
    const agentStreamData = await workflowEventsToStreamData(
      agent.streamEvents(),
    );
    // convert the workflow result to a vercel AI content stream
    const stream = toDataStream(result, {
      onFinal: () => agentStreamData.close(),
    });

    return streamToResponse(stream, res, {}, agentStreamData);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: (error as Error).message,
    });
  }
};
