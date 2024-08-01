import { NextResponse } from "next/server";
import { LLamaCloudFileService } from "../llamaindex/streaming/service";

/**
 * This API is to get config from the backend envs and expose them to the frontend
 */
export async function GET() {
  const config = {
    starterQuestions: process.env.CONVERSATION_STARTERS?.trim().split("\n"),
    llamaCloud: await getLLamaCloudConfig(),
  };
  return NextResponse.json(config, { status: 200 });
}

async function getLLamaCloudConfig() {
  if (!process.env.LLAMA_CLOUD_API_KEY) return undefined;
  const projects = await LLamaCloudFileService.getAllProjectsAndPipelines();
  return {
    projects,
  };
}
