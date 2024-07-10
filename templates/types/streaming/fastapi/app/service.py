import os
import requests
from typing import List, Any, Dict, Optional


class LLamaCloudFileService:
    @classmethod
    def get_files(cls, pipeline_id: str) -> List[Dict[str, Any]]:
        url = f"https://cloud.llamaindex.ai/api/v1/pipelines/{pipeline_id}/files"
        headers = {
            "Accept": "application/json",
            "Authorization": f'Bearer {os.getenv("LLAMA_CLOUD_API_KEY")}',
        }
        response = requests.get(url, headers=headers)
        return response.json()

    @classmethod
    def get_file_detail(cls, project_id: str, file_id: str) -> Dict[str, Any]:
        url = f"https://cloud.llamaindex.ai/api/v1/files/{file_id}/content?project_id={project_id}"
        headers = {
            "Accept": "application/json",
            "Authorization": f'Bearer {os.getenv("LLAMA_CLOUD_API_KEY")}',
        }
        response = requests.get(url, headers=headers)
        return response.json()

    @classmethod
    def download_file(cls, url: str, file_id: str, filename: str) -> str:
        directory = "data/private"  # TODO: move to output/llamacloud later
        delimiter = "$"  # delimiter between fileId and filename
        downloaded_file_name = f"{file_id}{delimiter}{filename}"
        downloaded_file_path = os.path.join(directory, downloaded_file_name)
        url_prefix = f"{os.getenv('FILESERVER_URL_PREFIX')}/{directory}"
        file_url = f"{url_prefix}/{downloaded_file_name}"

        # Check if file already exists
        if os.path.exists(downloaded_file_path):
            return file_url

        # Create directory if it doesn't exist
        os.makedirs(directory, exist_ok=True)

        # Download the file
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            with open(downloaded_file_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

        print("File downloaded successfully")
        return file_url

    @classmethod
    def get_file_url(cls, name: str, pipeline_id: str) -> Optional[str]:
        try:
            files = cls.get_files(pipeline_id)
            for file in files:
                if file["name"] == name:
                    file_id = file["file_id"]
                    project_id = file["project_id"]
                    file_detail = cls.get_file_detail(project_id, file_id)
                    local_file_url = cls.download_file(
                        file_detail["url"], file_id, name
                    )
                    return local_file_url
            return None
        except Exception as error:
            print(f"Error fetching file from LlamaCloud: {error}")
            return None
