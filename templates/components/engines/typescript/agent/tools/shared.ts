import fs from "fs";
import path from "node:path";

export const TOOL_OUTPUT_DIR = "output/tools";

export async function saveToolOutput(
  base64: string,
  filename: string,
  outputDir: string = TOOL_OUTPUT_DIR,
) {
  try {
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }
    const filePath = path.join(outputDir, filename);
    await fs.promises.writeFile(filePath, Buffer.from(base64, "base64"));
    console.log(`Saved file to ${filePath}`);
  } catch (error) {
    console.log(`Error saving file to ${outputDir}`, error);
  }
}
