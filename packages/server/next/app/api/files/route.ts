import { NextRequest, NextResponse } from "next/server";
import { storeFile } from "./helpers";

export async function POST(request: NextRequest) {
  try {
    const {
      name,
      base64,
    }: {
      name: string;
      base64: string;
    } = await request.json();
    if (!base64 || !name) {
      return NextResponse.json(
        { error: "base64 and name is required in the request body" },
        { status: 400 },
      );
    }

    const parts = base64.split(",");
    if (parts.length !== 2) {
      return NextResponse.json(
        { error: "Invalid base64 format" },
        { status: 400 },
      );
    }

    const [header, content] = parts;
    if (!header || !content) {
      return NextResponse.json(
        { error: "Invalid base64 format" },
        { status: 400 },
      );
    }

    const fileBuffer = Buffer.from(content, "base64");

    const file = await storeFile(name, fileBuffer);

    return NextResponse.json(file);
  } catch (error) {
    console.error("[Upload API]", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
}
