import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

/**
 * This API is to get file data from ./data folder
 * It receives a parameter `query` and response file data like serve static file
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");

  if (!query) {
    return NextResponse.json({ detail: "Missing file query" }, { status: 400 });
  }

  if (query.includes("..")) {
    return NextResponse.json({ detail: "Invalid file path" }, { status: 400 });
  }

  if (!query.endsWith(".pdf")) {
    return NextResponse.json(
      { detail: "Invalid file type. Support .pdf only" },
      { status: 400 },
    );
  }

  try {
    const pdfPath = path.join(process.cwd(), "data", query);
    const blob = await readFile(pdfPath);

    return new NextResponse(blob, {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": blob.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ detail: "File not found" }, { status: 404 });
  }
}
