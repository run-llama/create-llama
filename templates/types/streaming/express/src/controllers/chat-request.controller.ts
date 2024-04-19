import { Request, Response } from "express";
import { ChatMessage, MessageContent } from "llamaindex";
import { createChatEngine } from "./engine/chat";

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

export const chatRequest = async (req: Request, res: Response) => {
  try {
    const { messages, data }: { messages: ChatMessage[]; data: any } = req.body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return res.status(400).json({
        error:
          "messages are required in the request body and the last message must be from the user",
      });
    }

    // Convert message content from Vercel/AI format to LlamaIndex/OpenAI format
    // Note: The non-streaming template does not need the Vercel/AI format, we're still using it for consistency with the streaming template
    const userMessageContent = convertMessageContent(
      userMessage.content,
      data?.imageUrl,
    );

    const chatEngine = await createChatEngine();

    // Calling LlamaIndex's ChatEngine to get a response
    const response = await chatEngine.chat({
      message: userMessageContent,
      chatHistory: messages,
    });
    const result: ChatMessage = {
      role: "assistant",
      content: response.response,
    };

    return res.status(200).json({
      result,
    });
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: (error as Error).message,
    });
  }
};
