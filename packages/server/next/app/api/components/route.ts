import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promisify } from "util";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const componentsDir = params.get("componentsDir") || "components";

  try {
    const exists = await promisify(fs.exists)(componentsDir);
    if (!exists) {
      return NextResponse.json(
        { error: "Components directory not found" },
        { status: 404 },
      );
    }

    const files = await promisify(fs.readdir)(componentsDir);

    // filter files with valid extensions
    const validExtensions = [".tsx", ".jsx"];
    const filteredFiles = files.filter((file) =>
      validExtensions.includes(path.extname(file)),
    );

    // filter duplicate components
    const uniqueFiles = filterDuplicateComponents(filteredFiles);

    const components = await Promise.all(
      uniqueFiles.map(async (file) => {
        const filePath = path.join(componentsDir, file);
        const content = await promisify(fs.readFile)(filePath, "utf-8");
        return {
          type: path.basename(file, path.extname(file)),
          code: content,
          filename: file,
        };
      }),
    );

    return NextResponse.json(components, { status: 200 });
  } catch (error) {
    console.error("Error reading components:", error);
    return NextResponse.json(
      { error: "Failed to read components" },
      { status: 500 },
    );
  }
}

function filterDuplicateComponents(files: string[]) {
  const compMap = new Map<string, string>();

  for (const file of files) {
    const type = path.basename(file, path.extname(file));

    if (compMap.has(type)) {
      const existingComp = compMap.get(type)!;
      if (file.endsWith(".tsx") && !existingComp.endsWith(".tsx")) {
        // prefer .tsx files over others
        console.warn(`Preferring ${file} over ${existingComp}`);
        compMap.set(type, file);
      }
    } else {
      compMap.set(type, file);
    }
  }

  return Array.from(compMap.values());
}
