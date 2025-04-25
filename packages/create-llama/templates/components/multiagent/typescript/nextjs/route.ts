import { initObservability } from "@/app/observability";
import { LlamaIndexAdapter, type Message } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { initSettings } from "./engine/settings";
import {
  convertToChatHistory,
  isValidMessages,
  retrieveMessageContent,
} from "./llamaindex/streaming/annotations";
import { createWorkflow } from "./workflow/factory";
import { createStreamFromWorkflowContext } from "./workflow/stream";

initObservability();
initSettings();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages }: { messages: Message[]; data?: any } = body;
    if (!isValidMessages(messages)) {
      return NextResponse.json(
        {
          error:
            "messages are required in the request body and the last message must be from the user",
        },
        { status: 400 },
      );
    }

    const chatHistory = convertToChatHistory(messages);
    const userMessageContent = retrieveMessageContent(messages);

    const workflow = await createWorkflow({ chatHistory });

    const context = workflow.run({
      message: userMessageContent,
      streaming: true,
    });
    const { stream, dataStream } =
      await createStreamFromWorkflowContext(context);
    return LlamaIndexAdapter.toDataStreamResponse(stream, {
      data: dataStream,
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
  }
}
