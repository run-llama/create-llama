import { NextRequest, NextResponse } from "next/server";
import { initSettings } from "../engine/settings";
import { readAndSplitDocument } from "./embeddings";

initSettings();

export async function POST(request: NextRequest) {
  try {
    const { base64 }: { base64: string } = await request.json();
    if (!base64) {
      return NextResponse.json(
        { error: "base64 is required in the request body" },
        { status: 400 },
      );
    }
    return NextResponse.json(await readAndSplitDocument(base64));
  } catch (error) {
    console.error("[Embed API]", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
