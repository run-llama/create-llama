import { WorkflowEvent } from "@llamaindex/core/workflow";
import { Message, StreamData, streamToResponse } from "ai";
import { Request, Response } from "express";
import { ChatMessage } from "llamaindex";
import { createWorkflow } from "../examples/workflow";
import { createStreamTimeout } from "./llamaindex/streaming/events";
import { LlamaIndexStream } from "./llamaindex/streaming/stream";

export class MessageEvent extends WorkflowEvent<{ msg: string }> {}

export const chat = async (req: Request, res: Response) => {
  // Init Vercel AI StreamData and timeout
  const vercelStreamData = new StreamData();
  const streamTimeout = createStreamTimeout(vercelStreamData);
  try {
    const { messages }: { messages: Message[] } = req.body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error:
          "messages are required in the request body and the last message must be from the user",
      });
    }

    const specification = ""; // TODO: Add specification
    const agent = await createWorkflow(messages as ChatMessage[]); // Test with single workflow
    agent.run(specification);

    const response: AsyncIterable<WorkflowEvent<MessageEvent>> = {
      [Symbol.asyncIterator]() {
        return agent.streamEvents();
      },
    };
    const stream = LlamaIndexStream(
      response,
      vercelStreamData,
      messages as ChatMessage[],
    );

    return streamToResponse(stream, res, {}, vercelStreamData);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: (error as Error).message,
    });
  } finally {
    clearTimeout(streamTimeout);
  }
};
