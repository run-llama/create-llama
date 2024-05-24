import { Message, StreamData, streamToResponse } from "ai";
import { Request, Response } from "express";
import { ChatMessage, Settings } from "llamaindex";
import { createChatEngine } from "./engine/chat";
import {
  DataParserOptions,
  LlamaIndexStream,
  convertMessageContent,
} from "./llamaindex-stream";
import { createCallbackManager } from "./stream-helper";

export const chat = async (req: Request, res: Response) => {
  try {
    const {
      messages,
      data,
    }: { messages: Message[]; data: DataParserOptions | undefined } = req.body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error:
          "messages are required in the request body and the last message must be from the user",
      });
    }

    const chatEngine = await createChatEngine();

    // Convert message content from Vercel/AI format to LlamaIndex/OpenAI format
    const userMessageContent = convertMessageContent(userMessage.content, data);

    // Init Vercel AI StreamData
    const vercelStreamData = new StreamData();

    // Setup callbacks
    const callbackManager = createCallbackManager(vercelStreamData);

    // Calling LlamaIndex's ChatEngine to get a streamed response
    const response = await Settings.withCallbackManager(callbackManager, () => {
      return chatEngine.chat({
        message: userMessageContent,
        chatHistory: messages as ChatMessage[],
        stream: true,
      });
    });

    // Return a stream, which can be consumed by the Vercel/AI client
    const stream = LlamaIndexStream(response, vercelStreamData, {
      parserOptions: {
        imageUrl: data?.imageUrl,
        csvContent: data?.csvContent,
      },
    });

    return streamToResponse(stream, res, {}, vercelStreamData);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: (error as Error).message,
    });
  }
};
