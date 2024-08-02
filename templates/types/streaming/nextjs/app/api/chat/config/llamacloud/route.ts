import { NextResponse } from "next/server";
import { LLamaCloudFileService } from "../../llamaindex/streaming/service";

/**
 * This API is to get config from the backend envs and expose them to the frontend
 */
export async function GET() {
  const config = {
    projects: await LLamaCloudFileService.getAllProjectsWithPipelines(),
  };
  return NextResponse.json(config, { status: 200 });
}
