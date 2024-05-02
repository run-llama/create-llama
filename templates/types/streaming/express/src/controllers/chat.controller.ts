import { Message, StreamData, streamToResponse } from "ai";
import { Request, Response } from "express";
import {
  CallbackManager,
  ChatMessage,
  MessageContent,
  Settings,
} from "llamaindex";
import { createChatEngine } from "./engine/chat";
import { LlamaIndexStream } from "./llamaindex-stream";
import { appendEventData } from "./stream-helper";

const convertMessageContent = (
  textMessage: string,
  imageUrl: string | undefined,
): MessageContent => {
  if (!imageUrl) return textMessage;
  return [
    {
      type: "text",
      text: textMessage,
    },
    {
      type: "image_url",
      image_url: {
        url: imageUrl,
      },
    },
  ];
};

export const chat = async (req: Request, res: Response) => {
  try {
    const { messages, data }: { messages: Message[]; data: any } = req.body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error:
          "messages are required in the request body and the last message must be from the user",
      });
    }

    const chatEngine = await createChatEngine();

    // Convert message content from Vercel/AI format to LlamaIndex/OpenAI format
    const userMessageContent = convertMessageContent(
      userMessage.content,
      data?.imageUrl,
    );

    // Init Vercel AI StreamData
    const vercelStreamData = new StreamData();

    // Setup callbacks
    const callbackManager = new CallbackManager();
    callbackManager.on("retrieve", (data) => {
      const { nodes } = data.detail;
      appendEventData(
        vercelStreamData,
        `Retrieving context for query: '${userMessage.content}'`,
      );
      appendEventData(
        vercelStreamData,
        `Retrieved ${nodes.length} sources to use as context for the query`,
      );
    });

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
        image_url: data?.imageUrl,
      },
    });
    const processedStream = stream.pipeThrough(vercelStreamData.stream);

    return streamToResponse(processedStream, res);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: (error as Error).message,
    });
  }
};
