import { type AgentInputData } from "@llamaindex/workflow";
import { type Message } from "ai";
import { type MessageType } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";

// import chat utils
import {
  runWorkflow,
  sendSuggestedQuestionsEvent,
  toDataStream,
} from "./utils";

// import workflow factory and settings from local file
import { initSettings } from "./app/settings";
import { workflowFactory } from "./app/workflow";

initSettings();

export async function POST(req: NextRequest) {
  try {
    const reqBody = await req.json();
    const suggestNextQuestions = process.env.SUGGEST_NEXT_QUESTIONS === "true";

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
    req.signal.addEventListener("abort", () =>
      abortController.abort("Connection closed"),
    );

    const workflow = await workflowFactory(reqBody);
    const workflowEventStream = await runWorkflow(
      workflow,
      workflowInput,
      abortController.signal,
    );

    const dataStream = toDataStream(workflowEventStream, {
      callbacks: {
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
