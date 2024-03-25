import { Request, Response } from "express";
import { ChatMessage } from "llamaindex";
import { LlamaChatRequest } from "./chat.middleware";

export const chatRequest = async (req: Request, res: Response) => {
  try {
    const { userMessageContent, chatEngine, chatHistory } =
      req as LlamaChatRequest;
    const response = await chatEngine.chat({
      message: userMessageContent,
      chatHistory,
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
      error: (error as Error).message,
    });
  }
};
