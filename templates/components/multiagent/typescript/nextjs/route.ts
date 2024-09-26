import { initObservability } from "@/app/observability";
import { StopEvent } from "@llamaindex/core/workflow";
import { Message, StreamingTextResponse } from "ai";
import { ChatMessage, ChatResponseChunk } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";
import { initSettings } from "./engine/settings";
import { createWorkflow } from "./workflow/factory";
import { toDataStream, workflowEventsToStreamData } from "./workflow/stream";

initObservability();
initSettings();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages }: { messages: Message[] } = body;
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
    // TODO: fix type in agent.run in LITS
    const result = agent.run<AsyncGenerator<ChatResponseChunk>>(
      userMessage.content,
    ) as unknown as Promise<StopEvent<AsyncGenerator<ChatResponseChunk>>>;
    // convert the workflow events to a vercel AI stream data object
    const agentStreamData = await workflowEventsToStreamData(
      agent.streamEvents(),
    );
    // convert the workflow result to a vercel AI content stream
    const stream = toDataStream(result, {
      onFinal: () => agentStreamData.close(),
    });
    return new StreamingTextResponse(stream, {}, agentStreamData);
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
  }
}
