import { Metadata, NodeWithScore } from "llamaindex";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const LLAMA_CLOUD_OUTPUT_DIR = "output/llamacloud";
const LLAMA_CLOUD_BASE_URL = "https://cloud.llamaindex.ai/api/v1";
const FILE_DELIMITER = "$"; // delimiter between pipelineId and filename
const LLAMA_CLOUD_CONFIG_FILE = path.join("config", "llamacloud.json");

interface LlamaCloudFile {
  name: string;
  file_id: string;
  project_id: string;
}

interface LLamaCloudProject {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
}

interface LLamaCloudPipeline {
  id: string;
  name: string;
  project_id: string;
}

interface LLamaCloudConfig {
  project: string;
  pipeline: string;
}

export class LLamaCloudFileService {
  private static readonly headers = {
    Accept: "application/json",
    Authorization: `Bearer ${process.env.LLAMA_CLOUD_API_KEY}`,
  };

  public static async getAllProjectsAndPipelines() {
    try {
      const projects = await this.getAllProjects();
      const pipelines = await this.getAllPipelines();
      return projects.map((project) => ({
        ...project,
        pipelines: pipelines.filter((p) => p.project_id === project.id),
      }));
    } catch (error) {
      console.error("Error listing projects and pipelines:", error);
      return [];
    }
  }

  public static getConfig(): LLamaCloudConfig | undefined {
    try {
      return JSON.parse(fs.readFileSync(LLAMA_CLOUD_CONFIG_FILE, "utf-8"));
    } catch (error) {
      // If file doesn't exist, return undefined
      return undefined;
    }
  }

  public static async updateConfig(config: LLamaCloudConfig) {
    try {
      await fs.promises.writeFile(
        LLAMA_CLOUD_CONFIG_FILE,
        JSON.stringify(config, null, 2),
      );
    } catch (error) {
      throw new Error(`Error updating LlamaCloud config: ${error}`);
    }
  }

  public static async downloadFiles(nodes: NodeWithScore<Metadata>[]) {
    const files = this.nodesToDownloadFiles(nodes);
    if (!files.length) return;
    console.log("Downloading files from LlamaCloud...");
    for (const file of files) {
      await this.downloadFile(file.pipelineId, file.fileName);
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
      const isLocalFile = node.node.metadata["private"] != null;
      const pipelineId = node.node.metadata["pipeline_id"];
      const fileName = node.node.metadata["file_name"];
      if (isLocalFile || !pipelineId || !fileName) continue;
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
    const response = await fetch(url, { method: "GET", headers: this.headers });
    const data = (await response.json()) as { url: string };
    return data.url;
  }

  private static async getAllFiles(
    pipelineId: string,
  ): Promise<LlamaCloudFile[]> {
    const url = `${LLAMA_CLOUD_BASE_URL}/pipelines/${pipelineId}/files`;
    const response = await fetch(url, { method: "GET", headers: this.headers });
    const data = await response.json();
    return data;
  }

  private static async getAllProjects(): Promise<LLamaCloudProject[]> {
    const url = `${LLAMA_CLOUD_BASE_URL}/projects`;
    const response = await fetch(url, { method: "GET", headers: this.headers });
    const data = (await response.json()) as LLamaCloudProject[];
    return data;
  }

  private static async getAllPipelines(): Promise<LLamaCloudPipeline[]> {
    const url = `${LLAMA_CLOUD_BASE_URL}/pipelines`;
    const response = await fetch(url, { method: "GET", headers: this.headers });
    const data = (await response.json()) as LLamaCloudPipeline[];
    return data;
  }
}
