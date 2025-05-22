import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promisify } from "util";

const LAYOUT_TYPES = ["header", "footer"] as const;

type LayoutFile = {
  type: (typeof LAYOUT_TYPES)[number];
  filename: string;
  code: string;
};

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const layoutDir = params.get("layoutDir") || "layout";

  try {
    const exists = await promisify(fs.exists)(layoutDir);
    if (!exists) {
      return NextResponse.json(
        { error: "Layout directory not found" },
        { status: 404 },
      );
    }

    const files = await promisify(fs.readdir)(layoutDir);

    const layoutComponents = await Promise.all(
      LAYOUT_TYPES.map(async (type) => {
        const file = files.find(
          (file) => file === `${type}.tsx` || file === `${type}.jsx`,
        );
        if (!file) return null;
        const filePath = path.join(layoutDir, file);
        const content = await promisify(fs.readFile)(filePath, "utf-8");
        return {
          type,
          code: content,
          filename: file,
        };
      }),
    );

    return NextResponse.json(layoutComponents.filter(Boolean) as LayoutFile[], {
      status: 200,
    });
  } catch (error) {
    console.error("Error reading components:", error);
    return NextResponse.json(
      { error: "Failed to read components" },
      { status: 500 },
    );
  }
}
