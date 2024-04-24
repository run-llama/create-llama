import { Message, StreamData, streamToResponse } from "ai";
import { Request, Response } from "express";
import { ChatMessage, MessageContent, Settings } from "llamaindex";
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
    appendEventData(
      vercelStreamData,
      `Retrieving context for query: '${userMessage.content}'`,
    );

    // Setup callback for streaming data before chatting
    Settings.callbackManager.on("retrieve", (data) => {
      const { nodes } = data.detail;
      appendEventData(
        vercelStreamData,
        `Retrieved ${nodes.length} sources to use as context for the query`,
      );
    });

    // Calling LlamaIndex's ChatEngine to get a streamed response
    const response = await chatEngine.chat({
      message: userMessageContent,
      chatHistory: messages as ChatMessage[],
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
