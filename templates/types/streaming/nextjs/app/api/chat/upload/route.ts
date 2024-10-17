import { NextRequest, NextResponse } from "next/server";
import { getDataSource } from "../engine";
import { initSettings } from "../engine/settings";
import { uploadDocument } from "../llamaindex/documents/upload";

initSettings();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const {
      filename,
      base64,
      params,
      filetype,
      filesize,
    }: {
      filename: string;
      base64: string;
      params?: any;
      filetype: string;
      filesize: number;
    } = await request.json();
    if (!base64 || !filename) {
      return NextResponse.json(
        { error: "base64 and filename is required in the request body" },
        { status: 400 },
      );
    }
    const index = await getDataSource(params);
    const uploadedFileMeta = await uploadDocument(index, filename, base64);
    const documentFile = {
      id: uploadedFileMeta.id,
      filename: filename, // Original filename
      filesize,
      filetype,
      metadata: uploadedFileMeta,
    };
    return NextResponse.json(documentFile);
  } catch (error) {
    console.error("[Upload API]", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
