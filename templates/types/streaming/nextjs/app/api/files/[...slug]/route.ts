import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

/**
 * This API is to get file data from allowed folders
 * It receives path slug and response file data like serve static file
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string[] } },
) {
  const slug = params.slug;

  if (!slug) {
    return NextResponse.json({ detail: "Missing file slug" }, { status: 400 });
  }

  if (slug.includes("..") || path.isAbsolute(path.join(...slug))) {
    return NextResponse.json({ detail: "Invalid file path" }, { status: 400 });
  }

  const [folder, ...pathTofile] = params.slug; // data, file.pdf
  const allowedFolders = ["data", "tool-output"];

  if (!allowedFolders.includes(folder)) {
    return NextResponse.json({ detail: "No permission" }, { status: 400 });
  }

  try {
    const filePath = path.join(process.cwd(), folder, path.join(...pathTofile));
    const blob = await readFile(filePath);

    return new NextResponse(blob, {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Length": blob.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ detail: "File not found" }, { status: 404 });
  }
}
