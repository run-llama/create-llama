import { NextResponse } from "next/server";

interface ChatConfig {
  starterQuestions?: string[];
}

/**
 * This API is to get config from the backend envs and expose them to the frontend
 */
export async function GET() {
  const config: ChatConfig = {
    starterQuestions: process.env.CONVERSATION_STARTERS?.trim().split("\n"),
  };
  return NextResponse.json(config, { status: 200 });
}
