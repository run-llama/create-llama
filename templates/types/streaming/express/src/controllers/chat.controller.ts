import { JSONValue, Message, StreamData, streamToResponse } from "ai";
import { Request, Response } from "express";
import { ChatMessage, Settings } from "llamaindex";
import { createChatEngine } from "./engine/chat";
import {
  convertMessageContent,
  retrieveDocumentIds,
} from "./llamaindex/streaming/annotations";
import {
  createCallbackManager,
  createStreamTimeout,
} from "./llamaindex/streaming/events";
import { LlamaIndexStream } from "./llamaindex/streaming/stream";

export const chat = async (req: Request, res: Response) => {
  // Init Vercel AI StreamData and timeout
  const vercelStreamData = new StreamData();
  const streamTimeout = createStreamTimeout(vercelStreamData);
  try {
    const { messages, data }: { messages: Message[]; data?: any } = req.body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error:
          "messages are required in the request body and the last message must be from the user",
      });
    }

    let annotations = userMessage.annotations;
    if (!annotations) {
      // the user didn't send any new annotations with the last message
      // so use the annotations from the last user message that has annotations
      // REASON: GPT4 doesn't consider MessageContentDetail from previous messages, only strings
      annotations = messages
        .slice()
        .reverse()
        .find(
          (message) => message.role === "user" && message.annotations,
        )?.annotations;
    }

    // retrieve document Ids from the annotations of all messages (if any) and create chat engine with index
    const allAnnotations: JSONValue[] = [...messages, userMessage].flatMap(
      (message) => {
        return message.annotations ?? [];
      },
    );
    const ids = retrieveDocumentIds(allAnnotations);
    const chatEngine = await createChatEngine(ids, data);

    // Convert message content from Vercel/AI format to LlamaIndex/OpenAI format
    const userMessageContent = convertMessageContent(
      userMessage.content,
      annotations,
    );

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
