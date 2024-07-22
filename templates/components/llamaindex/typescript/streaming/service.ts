import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const LLAMA_CLOUD_OUTPUT_DIR = "output/llamacloud";
const LLAMA_CLOUD_BASE_URL = "https://cloud.llamaindex.ai/api/v1";

export interface LlamaCloudFile {
  name: string;
  file_id: string;
  project_id: string;
}

export class LLamaCloudFileService {
  static async getFiles(pipelineId: string): Promise<LlamaCloudFile[]> {
    const url = `${LLAMA_CLOUD_BASE_URL}/pipelines/${pipelineId}/files`;
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
    };
    const response = await fetch(url, { method: "GET", headers });
    const data = await response.json();
    return data;
  }

  static async getFileDetail(
    projectId: string,
    fileId: string,
  ): Promise<{ url: string }> {
    const url = `${LLAMA_CLOUD_BASE_URL}/files/${fileId}/content?project_id=${projectId}`;
    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
    };
    const response = await fetch(url, { method: "GET", headers });
    const data = (await response.json()) as { url: string };
    return data;
  }

  static async getFileUrl(
    name: string,
    pipelineId: string,
  ): Promise<string | null> {
    try {
      const files = await this.getFiles(pipelineId);
      for (const file of files) {
        if (file.name === name) {
          const fileId = file.file_id;
          const projectId = file.project_id;
          const fileDetail = await this.getFileDetail(projectId, fileId);
          const localFileUrl = this.downloadFile(fileDetail.url, fileId, name);
          return localFileUrl;
        }
      }
      return null;
    } catch (error) {
      console.error("Error fetching file from LlamaCloud:", error);
      return null;
    }
  }

  static downloadFile(url: string, fileId: string, filename: string) {
    const FILE_DELIMITER = "$"; // delimiter between fileId and filename
    const downloadedFileName = `${fileId}${FILE_DELIMITER}${filename}`;
    const downloadedFilePath = path.join(
      LLAMA_CLOUD_OUTPUT_DIR,
      downloadedFileName,
    );
    const urlPrefix = `${process.env.FILESERVER_URL_PREFIX}/${LLAMA_CLOUD_OUTPUT_DIR}`;
    const fileUrl = `${urlPrefix}/${downloadedFileName}`;

    try {
      // Check if file already exists
      if (fs.existsSync(downloadedFilePath)) return fileUrl;

      // Create directory if it doesn't exist
      if (!fs.existsSync(LLAMA_CLOUD_OUTPUT_DIR)) {
        fs.mkdirSync(LLAMA_CLOUD_OUTPUT_DIR, { recursive: true });
      }

      const file = fs.createWriteStream(downloadedFilePath);
      https
        .get(url, (response) => {
          response.pipe(file);
          file.on("finish", () => {
            file.close(() => {
              console.log("File downloaded successfully");
            });
          });
        })
        .on("error", (err) => {
          fs.unlink(downloadedFilePath, () => {
            console.error("Error downloading file:", err);
            throw err;
          });
        });

      return fileUrl;
    } catch (error) {
      throw new Error(`Error downloading file from LlamaCloud: ${error}`);
    }
  }
}
