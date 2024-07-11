import os
import logging
import requests
from typing import List, Any, Dict, Optional


logger = logging.getLogger("uvicorn")


class LLamaCloudFileService:
    LLAMA_CLOUD_URL = "https://cloud.llamaindex.ai/api/v1"
    # TODO: move to output/llamacloud later
    LOCAL_STORE_PATH = "data/private"

    @classmethod
    def make_request(
        cls, url: str, data = None, headers: Optional[Dict] = None, method: str = "get"
    ):
        if headers is None:
            headers = {
                "Accept": "application/json",
                "Authorization": f'Bearer {os.getenv("LLAMA_CLOUD_API_KEY")}',
            }
        response = requests.request(method, url, headers=headers, data=data)
        response.raise_for_status()
        return response.json()

    @classmethod
    def get_files(cls, pipeline_id: str) -> List[Dict[str, Any]]:
        url = f"{cls.LLAMA_CLOUD_URL}/pipelines/{pipeline_id}/files"
        return cls.make_request(url)

    @classmethod
    def get_file_detail(cls, project_id: str, file_id: str) -> Dict[str, Any]:
        url = f"{cls.LLAMA_CLOUD_URL}/files/{file_id}/content?project_id={project_id}"
        return cls.make_request(url)

    @classmethod
    def download_file(cls, url: str, file_id: str, filename: str) -> str:
        delimiter = "$"  # delimiter between fileId and filename
        downloaded_file_name = f"{file_id}{delimiter}{filename}"
        downloaded_file_path = os.path.join(cls.LOCAL_STORE_PATH, downloaded_file_name)
        url_prefix = f"{os.getenv('FILESERVER_URL_PREFIX')}/{cls.LOCAL_STORE_PATH}"
        file_url = f"{url_prefix}/{downloaded_file_name}"

        # Check if file already exists
        if os.path.exists(downloaded_file_path):
            return file_url

        # Create directory if it doesn't exist
        os.makedirs(cls.LOCAL_STORE_PATH, exist_ok=True)

        # Download the file
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            with open(downloaded_file_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)

        logger.info("File downloaded successfully")
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
            logger.info(f"Error fetching file from LlamaCloud: {error}")
            return None
