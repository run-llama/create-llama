import fs from "fs";
import { LLamaCloudFileService } from "llamaindex";
import { NextRequest, NextResponse } from "next/server";
import { promisify } from "util";
import { downloadFile } from "../helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const isUsingLlamaCloud = !!process.env.LLAMA_CLOUD_API_KEY;
  const filePath = (await params).slug.join("/");

  if (!filePath.startsWith("output") && !filePath.startsWith("data")) {
    return NextResponse.json({ error: "No permission" }, { status: 400 });
  }

  const decodedFilePath = decodeURIComponent(filePath);

  // if using llama cloud and file not exists, download it
  if (isUsingLlamaCloud) {
    const fileExists = await promisify(fs.exists)(decodedFilePath);
    if (!fileExists) {
      const { pipeline_id, file_name } =
        getLlamaCloudPipelineIdAndFileName(decodedFilePath);

      if (pipeline_id && file_name) {
        // get the file url from llama cloud
        const downloadUrl = await LLamaCloudFileService.getFileUrl(
          pipeline_id,
          file_name,
        );
        if (!downloadUrl) {
          return NextResponse.json(
            {
              error: `Cannot create LlamaCloud download url for pipeline_id=${pipeline_id}, file_name=${file_name}`,
            },
            { status: 404 },
          );
        }

        // download the LlamaCloud file to local
        await downloadFile(downloadUrl, decodedFilePath);
        console.log("File downloaded successfully to: ", decodedFilePath);
      }
    }
  }

  const fileExists = await promisify(fs.exists)(decodedFilePath);
  if (fileExists) {
    const fileBuffer = await promisify(fs.readFile)(decodedFilePath);
    return new NextResponse(fileBuffer);
  } else {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

function getLlamaCloudPipelineIdAndFileName(filePath: string) {
  const fileName = filePath.split("/").pop() ?? ""; // fileName is the last slug part (pipeline_id$file_name)

  const delimiterIndex = fileName.indexOf("$"); // delimiter is the first dollar sign in the fileName
  if (delimiterIndex === -1) {
    return { pipeline_id: "", file_name: "" };
  }

  const pipeline_id = fileName.slice(0, delimiterIndex); // before delimiter
  const file_name = fileName.slice(delimiterIndex + 1); // after delimiter

  return { pipeline_id, file_name };
}
