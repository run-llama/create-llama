import { initObservability } from "@/app/observability";
import { StopEvent } from "@llamaindex/core/workflow";
import { Message, StreamData, StreamingTextResponse } from "ai";
import { ChatMessage, ChatResponseChunk } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";
import { initSettings } from "./engine/settings";
import { createStreamTimeout } from "./llamaindex/streaming/events";
import { createWorkflow } from "./workflow/factory";
import { toDataStream } from "./workflow/stream";
import { AgentRunEvent } from "./workflow/type";

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

    const chatHistory = messages as ChatMessage[];
    const agent = createWorkflow(chatHistory);
    const result = agent.run<AsyncGenerator<ChatResponseChunk>>(
      userMessage.content,
    );
    // start consuming the agent events in the background -> move to stream.ts
    void (async () => {
      for await (const event of agent.streamEvents()) {
        // Add the event to vercelStreamData
        if (event instanceof AgentRunEvent) {
          const { name, msg } = event.data;
          vercelStreamData.appendMessageAnnotation({
            type: "agent",
            data: { agent: name, text: msg },
          });
        }
      }
    })();
    // TODO: fix type in agent.run in LITS
    const stream = toDataStream(
      result as unknown as Promise<
        StopEvent<AsyncGenerator<ChatResponseChunk>>
      >,
    );
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
