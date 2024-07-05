export interface LlamaCloudFile {
  name: string;
  file_id: string;
  project_id: string;
}

export class LLamaCloudFileService {
  static async getFiles(pipelineId: string): Promise<LlamaCloudFile[]> {
    const url = `https://cloud.llamaindex.ai/api/v1/pipelines/${pipelineId}/files`;
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
    const url = `https://cloud.llamaindex.ai/api/v1/files/${fileId}/content?project_id=${projectId}`;
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
    const files = await this.getFiles(pipelineId);
    for (const file of files) {
      if (file.name === name) {
        const fileId = file.file_id;
        const projectId = file.project_id;
        const fileDetail = await this.getFileDetail(projectId, fileId);
        return fileDetail.url;
      }
    }
    return null;
  }
}
