import { Message, StreamData, streamToResponse } from "ai";
import { Request, Response } from "express";
import { ChatMessage, Settings } from "llamaindex";
import { createChatEngine } from "./engine/chat";
import { LlamaIndexStream, convertMessageContent } from "./llamaindex-stream";
import { createCallbackManager, createStreamTimeout } from "./stream-helper";

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

    const chatEngine = await createChatEngine();

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
    const stream = LlamaIndexStream(response, vercelStreamData);

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
