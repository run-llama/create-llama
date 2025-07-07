import fs from "fs";
import { LLamaCloudFileService } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";
import { promisify } from "util";
import { downloadFile } from "../helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const filePath = (await params).slug.join("/");

  if (!filePath.startsWith("output") && !filePath.startsWith("data")) {
    return NextResponse.json({ error: "No permission" }, { status: 400 });
  }

  // if llamacloud file, check if exists, if not, download it
  if (filePath.startsWith("output/llamacloud")) {
    const fileExists = await promisify(fs.exists)(filePath);
    if (!fileExists) {
      // get file name and pipeline id from the file path: output/llamacloud/pipeline_id$file_name
      const startIndex =
        filePath.indexOf("output/llamacloud/") + "output/llamacloud/".length;
      const fileName = filePath.slice(startIndex); // pipeline_id$file_name
      const [pipeline_id, file_name] = fileName.split("$") ?? [];

      if (!pipeline_id || !file_name) {
        return NextResponse.json(
          {
            error: `Invalid LlamaCloud file path: ${filePath}`,
          },
          { status: 400 },
        );
      }

      // get the file url from llama cloud
      const downloadUrl = await LLamaCloudFileService.getFileUrl(
        pipeline_id,
        file_name,
      );
      if (!downloadUrl) {
        return NextResponse.json(
          {
            error: `Cannot find the file in LlamaCloud: pipeline_id=${pipeline_id}, file_name=${file_name}`,
          },
          { status: 404 },
        );
      }
      await downloadFile(downloadUrl, filePath);
      console.log("File downloaded successfully to: ", filePath);
    }
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
