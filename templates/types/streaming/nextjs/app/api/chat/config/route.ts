import { NextRequest, NextResponse } from "next/server";
import { LLamaCloudFileService } from "../llamaindex/streaming/service";

/**
 * This API is to get config from the backend envs and expose them to the frontend
 */
export async function GET() {
  const config = {
    starterQuestions: process.env.CONVERSATION_STARTERS?.trim().split("\n"),
    llamaCloud: {
      config: LLamaCloudFileService.getConfig(),
      projects: await LLamaCloudFileService.getAllProjectsAndPipelines(),
    },
  };
  return NextResponse.json(config, { status: 200 });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { project, pipeline }: { project: string; pipeline: string } = body;

  if (!project || !pipeline) {
    return NextResponse.json(
      { message: "Please provide project and pipeline names" },
      { status: 400 },
    );
  }

  try {
    await LLamaCloudFileService.updateConfig({ project, pipeline });
    return NextResponse.json(
      { message: "Successfully updated LlamaCloud configs" },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Failed to update LlamaCloud configs" },
      { status: 500 },
    );
  }
}
