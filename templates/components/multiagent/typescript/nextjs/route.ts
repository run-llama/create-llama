import { initObservability } from "@/app/observability";
import { StartEvent } from "@llamaindex/core/workflow";
import { Message, StreamingTextResponse } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { initSettings } from "./engine/settings";
import {
  isValidMessages,
  retrieveMessageContent,
} from "./llamaindex/streaming/annotations";
import { createWorkflow } from "./workflow/factory";
import { toDataStream, workflowEventsToStreamData } from "./workflow/stream";
import { AgentInput } from "./workflow/type";

initObservability();
initSettings();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, data }: { messages: Message[]; data?: any } = body;
    if (!isValidMessages(messages)) {
      return NextResponse.json(
        {
          error:
            "messages are required in the request body and the last message must be from the user",
        },
        { status: 400 },
      );
    }

    const userMessageContent = retrieveMessageContent(messages);
    const workflow = await createWorkflow({
      chatHistory: messages,
      writeEvents: true,
    });

    const result = workflow.run(
      new StartEvent<AgentInput>({
        input: {
          message: userMessageContent,
        },
      }),
    );

    // convert the workflow events to a vercel AI stream data object
    const agentStreamData = await workflowEventsToStreamData(
      workflow.streamEvents(),
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
