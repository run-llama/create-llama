import fs from "fs";
import { NextResponse } from "next/server";
import path from "path";
import { promisify } from "util";

const VALID_EXTENSIONS = [".tsx", ".jsx"];

export type Item = {
  type: string;
  filename: string;
  code: string;
};

function filterDuplicateFiles(files: string[]): string[] {
  const fileMap = new Map<string, string>();

  for (const file of files) {
    const type = path.basename(file, path.extname(file));

    if (fileMap.has(type)) {
      const existingFile = fileMap.get(type)!;
      // Prefer .tsx files
      if (file.endsWith(".tsx") && !existingFile.endsWith(".tsx")) {
        console.warn(`Preferring ${file} over ${existingFile}`);
        fileMap.set(type, file);
      }
    } else {
      fileMap.set(type, file);
    }
  }
  return Array.from(fileMap.values());
}

export async function handleComponentRoute(
  directory: string,
  itemTypes?: readonly string[],
): Promise<NextResponse> {
  try {
    const exists = await promisify(fs.exists)(directory);
    if (!exists) {
      return NextResponse.json(
        { error: `Directory not found at ${directory}` },
        { status: 404 },
      );
    }

    const filesInDir = await promisify(fs.readdir)(directory);
    const validFiles = filesInDir.filter((file) =>
      VALID_EXTENSIONS.includes(path.extname(file)),
    );
    let filesToProcess = filterDuplicateFiles(validFiles);

    if (itemTypes?.length) {
      // Specific item types provided (e.g., for layouts "header", "footer")
      filesToProcess = filesToProcess.filter((file) =>
        itemTypes.includes(path.basename(file, path.extname(file))),
      );
    }

    const items: Item[] = await Promise.all(
      filesToProcess.map(async (file) => {
        const filePath = path.join(directory, file);
        const content = await promisify(fs.readFile)(filePath, "utf-8");
        return {
          type: path.basename(file, path.extname(file)),
          code: content,
          filename: file,
        };
      }),
    );

    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error);
    return NextResponse.json(
      { error: `Failed to read directory ${directory}` },
      { status: 500 },
    );
  }
}
