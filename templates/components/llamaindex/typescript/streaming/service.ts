import { Metadata, NodeWithScore } from "llamaindex";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const LLAMA_CLOUD_OUTPUT_DIR = "output/llamacloud";
const LLAMA_CLOUD_BASE_URL = "https://cloud.llamaindex.ai/api/v1";
const FILE_DELIMITER = "$"; // delimiter between pipelineId and filename

interface LlamaCloudFile {
  name: string;
  file_id: string;
  project_id: string;
}

export class LLamaCloudFileService {
  public static async downloadFiles(nodes: NodeWithScore<Metadata>[]) {
    console.log("Downloading files from LlamaCloud...");
    const files = this.nodesToDownloadFiles(nodes);
    for (const file of files) {
      await this.downloadFile(file.pipelineId, file.fileName);
    }
  }

  public static toDownloadedName(pipelineId: string, fileName: string) {
    return `${pipelineId}${FILE_DELIMITER}${fileName}`;
  }

  private static nodesToDownloadFiles(nodes: NodeWithScore<Metadata>[]) {
    const downloadFiles: Array<{
      pipelineId: string;
      fileName: string;
    }> = [];
    for (const node of nodes) {
      const isLocalFile = node.node.metadata["is_local_file"] === "true";
      if (isLocalFile) continue;
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
      const downloadedName = this.toDownloadedName(pipelineId, fileName);
      const downloadedPath = path.join(LLAMA_CLOUD_OUTPUT_DIR, downloadedName);

      // Check if file already exists
      if (fs.existsSync(downloadedPath)) return;

      const urlToDownload = await this.getFileUrlByName(pipelineId, fileName);
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
    const files = await this.getAllFiles(pipelineId);
    const file = files.find((file) => file.name === name);
    if (!file) return null;
    return await this.getFileUrlById(file.project_id, file.file_id);
  }

  private static async getFileUrlById(
    projectId: string,
    fileId: string,
  ): Promise<string> {
    const url = `${LLAMA_CLOUD_BASE_URL}/files/${fileId}/content?project_id=${projectId}`;
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
    };
    const response = await fetch(url, { method: "GET", headers });
    const data = (await response.json()) as { url: string };
    return data.url;
  }

  private static async getAllFiles(
    pipelineId: string,
  ): Promise<LlamaCloudFile[]> {
    const url = `${LLAMA_CLOUD_BASE_URL}/pipelines/${pipelineId}/files`;
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
    };
    const response = await fetch(url, { method: "GET", headers });
    const data = await response.json();
    return data;
  }
}
