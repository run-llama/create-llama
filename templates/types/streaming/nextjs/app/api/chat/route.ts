import { initObservability } from "@/app/observability";
import { JSONValue, LlamaIndexAdapter, Message, StreamData } from "ai";
import { ChatMessage, Settings } from "llamaindex";
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
import { generateNextQuestions } from "./llamaindex/streaming/suggestion";

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

    return LlamaIndexAdapter.toDataStreamResponse(response, {
      data: vercelStreamData,
      callbacks: { onFinal },
    });
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
