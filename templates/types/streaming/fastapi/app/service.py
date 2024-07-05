import os
import requests
from typing import List, Any, Dict


class LLamaCloudFileService:
    @classmethod
    def get_files(cls, pipeline_id: str) -> List[Dict[str, Any]]:
        url = f"https://cloud.llamaindex.ai/api/v1/pipelines/{pipeline_id}/files"
        payload = {}
        headers = {
            "Accept": "application/json",
            "Authorization": f'Bearer {os.getenv("LLAMA_CLOUD_API_KEY")}',
        }
        response = requests.request("GET", url, headers=headers, data=payload)
        return response.json()

    @classmethod
    def get_file_detail(cls, project_id: str, file_id: str) -> str:
        url = f"https://cloud.llamaindex.ai/api/v1/files/{file_id}/content?project_id={project_id}"
        payload = {}
        headers = {
            "Accept": "application/json",
            "Authorization": f'Bearer {os.getenv("LLAMA_CLOUD_API_KEY")}',
        }
        response = requests.request("GET", url, headers=headers, data=payload)
        return response.json()

    @classmethod
    def get_file_url(cls, name: str, pipeline_id: str) -> str | None:
        files = cls.get_files(pipeline_id)
        for file in files:
            if file["name"] == name:
                file_id = file["file_id"]
                project_id = file["project_id"]
                return cls.get_file_detail(project_id, file_id)["url"]
        return None
