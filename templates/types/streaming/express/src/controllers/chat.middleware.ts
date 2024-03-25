import { NextFunction, Request, Response } from "express";
import { ChatEngine, ChatMessage, MessageContent, OpenAI } from "llamaindex";
import { createChatEngine } from "./engine/chat";

export interface LlamaChatRequest extends Request {
  userMessageContent: MessageContent;
  chatEngine: ChatEngine;
  chatHistory: ChatMessage[];
  parserOptions?: any;
}

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

export const chatMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const request = req as LlamaChatRequest;
  const { messages, data }: { messages: ChatMessage[]; data: any } =
    request.body;
  const userMessage = messages.pop();
  if (!messages || !userMessage || userMessage.role !== "user") {
    return res.status(400).json({
      error:
        "messages are required in the request body and the last message must be from the user",
    });
  }

  const llm = new OpenAI({
    model: process.env.MODEL || "gpt-3.5-turbo",
  });

  // Convert message content from Vercel/AI format to LlamaIndex/OpenAI format
  // Note: The non-streaming template does not need the Vercel/AI format, we're still using it for consistency with the streaming template
  const userMessageContent = convertMessageContent(
    userMessage.content,
    data?.imageUrl,
  );

  const chatEngine = await createChatEngine(llm);

  request.userMessageContent = userMessageContent;
  request.chatHistory = messages;
  request.chatEngine = chatEngine;
  request.parserOptions = {
    image_url: data?.imageUrl,
  };

  next();
};
