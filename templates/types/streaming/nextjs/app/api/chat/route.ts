import { initObservability } from "@/app/observability";
import { JSONValue, Message, StreamData, StreamingTextResponse } from "ai";
import { CallbackManager, ChatMessage, Settings } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";
import { createChatEngine } from "./engine/chat";
import { initSettings } from "./engine/settings";
import {
  convertMessageContent,
  retrieveDocumentIds,
} from "./llamaindex/streaming/annotations";
import {
  createCallbackManager,
  createStreamTimeout,
} from "./llamaindex/streaming/events";
import { LlamaIndexStream } from "./llamaindex/streaming/stream";

initObservability();
initSettings();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Init Vercel AI StreamData and timeout
  const vercelStreamData = new StreamData();
  const streamTimeout = createStreamTimeout(vercelStreamData);

  try {
    const body = await request.json();
    const { messages, data }: { messages: Message[]; data?: any } = body;
    const userMessage = messages.pop();
    if (!messages || !userMessage || userMessage.role !== "user") {
      return NextResponse.json(
        {
          error:
            "messages are required in the request body and the last message must be from the user",
        },
        { status: 400 },
      );
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

    const fakeDispatchEvent = async (callbackManager: CallbackManager) => {
      const wait = (ms: number = 100) => {
        return new Promise((resolve) => setTimeout(resolve, ms));
      };

      const dispatchToolCall = (agent: string, query: string) => {
        callbackManager.dispatchEvent("llm-tool-call", {
          toolCall: {
            id: `ID-${agent}`,
            name: agent,
            input: { query },
          },
        });
        return [agent, query];
      };

      const dispatchToolResult = (
        agent: string,
        query: string,
        output: any,
      ) => {
        callbackManager.dispatchEvent("llm-tool-result", {
          toolCall: {
            id: `ID-${agent}`,
            name: agent,
            input: { query },
          },
          toolResult: {
            tool: {
              metadata: {
                name: agent,
                description: `${agent} description`,
              },
              call: (_input: any) => ({}),
            },
            output,
            isError: false,
            input: { query },
          },
        });
      };

      // Researcher
      dispatchToolCall("Researcher", "Articles about LlamaIndex");
      await wait();
      dispatchToolResult("Researcher", "Articles about LlamaIndex", {
        data: ["Introducing LlamaIndex", "LlamaIndex Newsletter"],
        delegatedAgent: "Writer",
      });

      // Writer
      dispatchToolCall("Writer", "Write blog post");
      await wait();
      dispatchToolResult("Writer", "Write blog post", {
        data: "LlamaIndex is a great LLM tool...",
        delegatedAgent: "Reviewer",
      });

      // Reviewer
      dispatchToolCall("Reviewer", "Review blog post");
      await wait();
      dispatchToolResult("Reviewer", "Review blog post", {
        data: "The blog post is good",
        delegatedAgent: "Writer",
      });

      // Writer
      dispatchToolCall(
        "Writer",
        "Write a blog post to introduce the great LLM tool LlamaIndex",
      );
      await wait();
      dispatchToolResult(
        "Writer",
        "Write a blog post to introduce the great LLM tool LlamaIndex",
        {
          data: "LlamaIndex is a great LLM tool...",
        },
      );

      return "Write a blog post to introduce the great LLM tool LlamaIndex";
    };

    // Calling LlamaIndex's ChatEngine to get a streamed response
    const response = await Settings.withCallbackManager(
      callbackManager,
      async () => {
        const fakeSuggestion = await fakeDispatchEvent(callbackManager);
        return chatEngine.chat({
          message: userMessageContent + `\nExample: ${fakeSuggestion}`,
          chatHistory: messages as ChatMessage[],
          stream: true,
        });
      },
    );

    // Transform LlamaIndex stream to Vercel/AI format
    const stream = LlamaIndexStream(
      response,
      vercelStreamData,
      messages as ChatMessage[],
    );

    // Return a StreamingTextResponse, which can be consumed by the Vercel/AI client
    return new StreamingTextResponse(stream, {}, vercelStreamData);
  } catch (error) {
    console.error("[LlamaIndex]", error);
    return NextResponse.json(
      {
        detail: (error as Error).message,
      },
      {
        status: 500,
      },
    );
  } finally {
    clearTimeout(streamTimeout);
  }
}
