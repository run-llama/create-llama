import { getEnv } from "@llamaindex/env";
import { LLamaCloudFileService } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!getEnv("LLAMA_CLOUD_API_KEY")) {
    return NextResponse.json(
      {
        error: "env variable LLAMA_CLOUD_API_KEY is required to use LlamaCloud",
      },
      { status: 500 },
    );
  }

  try {
    const config = {
      projects: await LLamaCloudFileService.getAllProjectsWithPipelines(),
      pipeline: {
        pipeline: getEnv("LLAMA_CLOUD_INDEX_NAME"),
        project: getEnv("LLAMA_CLOUD_PROJECT_NAME"),
      },
    };
    return NextResponse.json(config, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch LlamaCloud configuration",
      },
      { status: 500 },
    );
  }
}
