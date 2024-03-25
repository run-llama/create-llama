import { streamToResponse } from "ai";
import { Request, Response } from "express";
import { LlamaChatRequest } from "./chat.middleware";
import { LlamaIndexStream } from "./llamaindex-stream";

export const chat = async (req: Request, res: Response) => {
  try {
    const { userMessageContent, chatEngine, chatHistory, parserOptions } =
      req as LlamaChatRequest;

    // Calling LlamaIndex's ChatEngine to get a streamed response
    const response = await chatEngine.chat({
      message: userMessageContent,
      chatHistory,
      stream: true,
    });

    // Return a stream, which can be consumed by the Vercel/AI client
    const { stream, data: streamData } = LlamaIndexStream(response, {
      parserOptions,
    });

    // Pipe LlamaIndexStream to response
    const processedStream = stream.pipeThrough(streamData.stream);
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
      error: (error as Error).message,
    });
  }
};
