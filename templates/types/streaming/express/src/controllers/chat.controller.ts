import { StreamData, streamToResponse } from "ai";
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
    const { messages, data }: { messages: ChatMessage[]; data: any } = req.body;
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
      userMessage.content as string,
      data?.imageUrl,
    );

    // Init Vercel AI StreamData
    const vercelStreamData = new StreamData();

    // Setup callback for streaming data before chatting
    Settings.callbackManager = new CallbackManager({
      onRetrieve: ({ query, nodes }) => {
        const eventTitle = `Retrieved ${nodes.length} nodes for query: '${query}'`;
        appendEventData(vercelStreamData, eventTitle);
      },
    });

    // Calling LlamaIndex's ChatEngine to get a streamed response
    const response = await chatEngine.chat({
      message: userMessageContent,
      chatHistory: messages,
      stream: true,
    });

    // Return a stream, which can be consumed by the Vercel/AI client
    const { stream } = LlamaIndexStream(response, vercelStreamData, {
      parserOptions: {
        image_url: data?.imageUrl,
      },
    });

    // Pipe LlamaIndexStream to response
    const processedStream = stream.pipeThrough(vercelStreamData.stream);
    return streamToResponse(processedStream, res, {
      headers: {
        // response MUST have the `X-Experimental-Stream-Data: 'true'` header
        // so that the client uses the correct parsing logic, see
        // https://sdk.vercel.ai/docs/api-reference/stream-data#on-the-server
        "X-Experimental-Stream-Data": "true",
        "Content-Type": "text/plain; charset=utf-8",
        "Access-Control-Expose-Headers": "X-Experimental-Stream-Data",
      },
    });
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: (error as Error).message,
    });
  }
};
