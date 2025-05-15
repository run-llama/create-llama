import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { promisify } from "util";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string[] } },
) {
  const filePath = params.slug.join("/");

  if (!filePath.startsWith("output") && !filePath.startsWith("data")) {
    return NextResponse.json({ error: "No permission" }, { status: 400 });
  }

  const decodedFilePath = decodeURIComponent(filePath);
  const fileExists = await promisify(fs.exists)(decodedFilePath);

  if (fileExists) {
    const fileBuffer = await promisify(fs.readFile)(decodedFilePath);
    return new NextResponse(fileBuffer);
  } else {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
