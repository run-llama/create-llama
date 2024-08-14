import {
  FilesService,
  OpenAPI,
  PipelinesService,
  ProjectsService,
} from "@llamaindex/cloud/api";
import { Metadata, NodeWithScore } from "llamaindex";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const LLAMA_CLOUD_OUTPUT_DIR = "output/llamacloud";
const LLAMA_CLOUD_BASE_URL = "https://cloud.llamaindex.ai/api/v1";
const FILE_DELIMITER = "$"; // delimiter between pipelineId and filename

type LlamaCloudFile = {
  name: string;
  file_id: string;
  project_id: string;
};

function initClient() {
  const apiKey = process.env.LLAMA_CLOUD_API_KEY;
  const baseUrl = process.env.LLAMA_CLOUD_BASE_URL;
  if (!apiKey) throw new Error("LLamaCloud API Key is required");
  OpenAPI.TOKEN = apiKey;
  if (baseUrl) OpenAPI.BASE = baseUrl;
}
initClient();

export class LLamaCloudFileService {
  private static readonly headers = {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
  };

  public static async addFileToPipeline(
    projectId: string,
    pipelineId: string,
    uploadFile: File | Blob,
    customMetadata: Record<string, any> = {},
  ) {
    const file = await FilesService.uploadFileApiV1FilesPost({
      projectId,
      formData: {
        upload_file: uploadFile,
      },
    });
    const files = [
      {
        file_id: file.id,
        custom_metadata: { file_id: file.id, ...customMetadata },
      },
    ];
    await PipelinesService.addFilesToPipelineApiV1PipelinesPipelineIdFilesPut({
      pipelineId,
      requestBody: files,
    });

    // Wait 2s for the file to be processed
    const maxAttempts = 20;
    let attempt = 0;
    while (attempt < maxAttempts) {
      const result =
        await PipelinesService.getPipelineFileStatusApiV1PipelinesPipelineIdFilesFileIdStatusGet(
          {
            pipelineId,
            fileId: file.id,
          },
        );
      if (result.status === "ERROR") {
        throw new Error(`File processing failed: ${JSON.stringify(result)}`);
      }
      if (result.status === "SUCCESS") {
        // File is ingested - return the file id
        return file.id;
      }
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 100)); // Sleep for 100ms
    }
    throw new Error(
      `File processing did not complete after ${maxAttempts} attempts.`,
    );
  }

  public static async getAllProjectsWithPipelines() {
    try {
      const projects = await ProjectsService.listProjectsApiV1ProjectsGet();
      const pipelines =
        await PipelinesService.searchPipelinesApiV1PipelinesGet();
      return projects.map((project) => ({
        ...project,
        pipelines: pipelines.filter((p) => p.project_id === project.id),
      }));
    } catch (error) {
      console.error("Error listing projects and pipelines:", error);
      return [];
    }
  }

  public static async downloadFiles(nodes: NodeWithScore<Metadata>[]) {
    const files = LLamaCloudFileService.nodesToDownloadFiles(nodes);
    if (!files.length) return;
    console.log("Downloading files from LlamaCloud...");
    for (const file of files) {
      await LLamaCloudFileService.downloadFile(file.pipelineId, file.fileName);
    }
  }

  public static toDownloadedName(pipelineId: string, fileName: string) {
    return `${pipelineId}${FILE_DELIMITER}${fileName}`;
  }

  /**
   * This function will return an array of unique files to download from LlamaCloud
   * We only download files that are uploaded directly in LlamaCloud datasources (don't have `private` in metadata)
   * Files are uploaded directly in LlamaCloud datasources don't have `private` in metadata (public docs)
   * Files are uploaded from local via `generate` command will have `private=false` (public docs)
   * Files are uploaded from local via `/chat/upload` endpoint will have `private=true` (private docs)
   *
   * @param nodes
   * @returns list of unique files to download
   */
  private static nodesToDownloadFiles(nodes: NodeWithScore<Metadata>[]) {
    const downloadFiles: Array<{
      pipelineId: string;
      fileName: string;
    }> = [];
    for (const node of nodes) {
      const pipelineId = node.node.metadata["pipeline_id"];
      const fileName = node.node.metadata["file_name"];
      if (!pipelineId || !fileName) continue;
      const isDuplicate = downloadFiles.some(
        (f) => f.pipelineId === pipelineId && f.fileName === fileName,
      );
      if (!isDuplicate) {
        downloadFiles.push({ pipelineId, fileName });
      }
    }
    return downloadFiles;
  }

  private static async downloadFile(pipelineId: string, fileName: string) {
    try {
      const downloadedName = LLamaCloudFileService.toDownloadedName(
        pipelineId,
        fileName,
      );
      const downloadedPath = path.join(LLAMA_CLOUD_OUTPUT_DIR, downloadedName);

      // Check if file already exists
      if (fs.existsSync(downloadedPath)) return;

      const urlToDownload = await LLamaCloudFileService.getFileUrlByName(
        pipelineId,
        fileName,
      );
      if (!urlToDownload) throw new Error("File not found in LlamaCloud");

      const file = fs.createWriteStream(downloadedPath);
      https
        .get(urlToDownload, (response) => {
          response.pipe(file);
          file.on("finish", () => {
            file.close(() => {
              console.log("File downloaded successfully");
            });
          });
        })
        .on("error", (err) => {
          fs.unlink(downloadedPath, () => {
            console.error("Error downloading file:", err);
            throw err;
          });
        });
    } catch (error) {
      throw new Error(`Error downloading file from LlamaCloud: ${error}`);
    }
  }

  private static async getFileUrlByName(
    pipelineId: string,
    name: string,
  ): Promise<string | null> {
    const files = await LLamaCloudFileService.getAllFiles(pipelineId);
    const file = files.find((file) => file.name === name);
    if (!file) return null;
    return await LLamaCloudFileService.getFileUrlById(
      file.project_id,
      file.file_id,
    );
  }

  // TODO: replace all REST API calls with LlamaCloudClient
  private static async getFileUrlById(
    projectId: string,
    fileId: string,
  ): Promise<string> {
    const url = `${LLAMA_CLOUD_BASE_URL}/files/${fileId}/content?project_id=${projectId}`;
    const response = await fetch(url, {
      method: "GET",
      headers: LLamaCloudFileService.headers,
    });
    const data = (await response.json()) as { url: string };
    return data.url;
  }

  private static async getAllFiles(
    pipelineId: string,
  ): Promise<LlamaCloudFile[]> {
    const url = `${LLAMA_CLOUD_BASE_URL}/pipelines/${pipelineId}/files`;
    const response = await fetch(url, {
      method: "GET",
      headers: LLamaCloudFileService.headers,
    });
    const data = await response.json();
    return data;
  }
}
