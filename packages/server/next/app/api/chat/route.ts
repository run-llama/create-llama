import type { AgentInputData } from "@llamaindex/workflow";
import { type Message } from "ai";
import type { MessageType } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";
import { toDataStreamResponse } from "./utils/stream";
import { sendSuggestedQuestionsEvent } from "./utils/suggestion";
import { runWorkflow } from "./utils/workflow";

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serverOptions = (globalThis as any).serverOptions;
  const workflowFactory = serverOptions.workflowFactory;

  if (!workflowFactory) {
    return NextResponse.json(
      {
        detail: "Workflow factory is not defined in global server options",
      },
      { status: 500 },
    );
  }

  try {
    const reqBody = await req.json();
    const { messages } = reqBody as { messages: Message[] };
    const chatHistory = messages.map((message) => ({
      role: message.role as MessageType,
      content: message.content,
    }));

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== "user") {
      return NextResponse.json(
        {
          detail: "Messages cannot be empty and last message must be from user",
        },
        { status: 400 },
      );
    }
    const workflowInput: AgentInputData = {
      userInput: lastMessage.content,
      chatHistory,
    };

    const abortController = new AbortController();
    // res.on("close", () => abortController.abort("Connection closed"));

    const workflow = await workflowFactory(reqBody);
    const workflowEventStream = await runWorkflow(
      workflow,
      workflowInput,
      abortController.signal,
    );

    return toDataStreamResponse(workflowEventStream, {
      callbacks: {
        onFinal: async (completion, dataStreamWriter) => {
          chatHistory.push({
            role: "assistant" as MessageType,
            content: completion,
          });
          await sendSuggestedQuestionsEvent(dataStreamWriter, chatHistory);
        },
      },
    });
  } catch (error) {
    console.error("Chat handler error:", error);
    return NextResponse.json(
      {
        detail: (error as Error).message || "Internal server error",
      },
      { status: 500 },
    );
  }
}
