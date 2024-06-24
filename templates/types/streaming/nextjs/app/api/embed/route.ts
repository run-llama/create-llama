import { NextRequest, NextResponse } from "next/server";
import { initSettings } from "../engine/settings";
import { getPdfDetail } from "./embeddings";

initSettings();

export async function POST(request: NextRequest) {
  try {
    const { pdf }: { pdf: string } = await request.json();
    if (!pdf) {
      return NextResponse.json(
        { error: "pdf is required in the request body" },
        { status: 400 },
      );
    }
    const pdfDetail = await getPdfDetail(pdf);
    return NextResponse.json(pdfDetail);
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
