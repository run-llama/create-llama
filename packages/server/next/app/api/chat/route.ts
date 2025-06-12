import { type Message } from "ai";
import { type MessageType } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";

// import chat utils
import {
  getHumanResponsesFromMessage,
  pauseForHumanInput,
  processWorkflowStream,
  runWorkflow,
  sendSuggestedQuestionsEvent,
  toDataStream,
} from "./utils";

// import workflow factory and settings from local file
import { stopAgentEvent } from "@llamaindex/workflow";
import { initSettings } from "./app/settings";
import { workflowFactory } from "./app/workflow";

initSettings();

export async function POST(req: NextRequest) {
  try {
    const reqBody = await req.json();
    const suggestNextQuestions = process.env.SUGGEST_NEXT_QUESTIONS === "true";

    const { messages, id: requestId } = reqBody as {
      messages: Message[];
      id?: string;
    };
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

    const abortController = new AbortController();
    req.signal.addEventListener("abort", () =>
      abortController.abort("Connection closed"),
    );

    const context = await runWorkflow({
      workflow: await workflowFactory(reqBody),
      input: { userInput: lastMessage.content, chatHistory },
      human: {
        snapshotId: requestId, // use requestId to restore snapshot
        responses: getHumanResponsesFromMessage(lastMessage),
      },
    });

    const stream = processWorkflowStream(context.stream).until(
      (event) =>
        abortController.signal.aborted || stopAgentEvent.include(event),
    );

    const dataStream = toDataStream(stream, {
      callbacks: {
        onPauseForHumanInput: async (responseEvent) => {
          await pauseForHumanInput(context, responseEvent, requestId); // use requestId to save snapshot
        },
        onFinal: async (completion, dataStreamWriter) => {
          chatHistory.push({
            role: "assistant" as MessageType,
            content: completion,
          });
          if (suggestNextQuestions) {
            await sendSuggestedQuestionsEvent(dataStreamWriter, chatHistory);
          }
        },
      },
    });
    return new Response(dataStream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
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
