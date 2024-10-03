import { LlamaIndexAdapter, Message, StreamData, streamToResponse } from "ai";
import { Request, Response } from "express";
import { ChatMessage, Settings } from "llamaindex";
import { createChatEngine } from "./engine/chat";
import {
  isValidMessages,
  retrieveDocumentIds,
  retrieveMessageContent,
} from "./llamaindex/streaming/annotations";
import { createCallbackManager } from "./llamaindex/streaming/events";
import { generateNextQuestions } from "./llamaindex/streaming/suggestion";

export const chat = async (req: Request, res: Response) => {
  // Init Vercel AI StreamData and timeout
  const vercelStreamData = new StreamData();
  try {
    const { messages, data }: { messages: Message[]; data?: any } = req.body;
    if (!isValidMessages(messages)) {
      return res.status(400).json({
        error:
          "messages are required in the request body and the last message must be from the user",
      });
    }

    // retrieve document ids from the annotations of all messages (if any)
    const ids = retrieveDocumentIds(messages);
    // create chat engine with index using the document ids
    const chatEngine = await createChatEngine(ids, data);

    // retrieve user message content from Vercel/AI format
    const userMessageContent = retrieveMessageContent(messages);

    // Setup callbacks
    const callbackManager = createCallbackManager(vercelStreamData);
    const chatHistory: ChatMessage[] = messages as ChatMessage[];

    // Calling LlamaIndex's ChatEngine to get a streamed response
    const response = await Settings.withCallbackManager(callbackManager, () => {
      return chatEngine.chat({
        message: userMessageContent,
        chatHistory,
        stream: true,
      });
    });

    const onFinal = (content: string) => {
      chatHistory.push({ role: "assistant", content: content });
      generateNextQuestions(chatHistory)
        .then((questions: string[]) => {
          if (questions.length > 0) {
            vercelStreamData.appendMessageAnnotation({
              type: "suggested_questions",
              data: questions,
            });
          }
        })
        .finally(() => {
          vercelStreamData.close();
        });
    };

    const stream = LlamaIndexAdapter.toDataStream(response, { onFinal });
    return streamToResponse(stream, res, {}, vercelStreamData);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return res.status(500).json({
      detail: (error as Error).message,
    });
  }
};
