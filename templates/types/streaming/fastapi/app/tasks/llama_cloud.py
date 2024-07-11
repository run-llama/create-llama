import os
import logging
import requests
from typing import List, Any, Dict, Optional


logger = logging.getLogger("uvicorn")


class LLamaCloudFile:

    LLAMA_CLOUD_URL = "https://cloud.llamaindex.ai/api/v1"
    # TODO: move to output/llamacloud later
    LOCAL_STORE_PATH = "data/private"

    DOWNLOAD_FILE_NAME_TPL = "{pipeline_id}${filename}"

    @classmethod
    def get_files(cls, pipeline_id: str) -> List[Dict[str, Any]]:
        url = f"{cls.LLAMA_CLOUD_URL}/pipelines/{pipeline_id}/files"
        return cls.make_request(url)

    @classmethod
    def get_file_detail(cls, project_id: str, file_id: str) -> Dict[str, Any]:
        url = f"{cls.LLAMA_CLOUD_URL}/files/{file_id}/content?project_id={project_id}"
        return cls.make_request(url)

    @classmethod
    def download_file(cls, url: str, local_file_path: str):
        logger.info(f"Downloading file to {local_file_path}")
        # Create directory if it doesn't exist
        os.makedirs(cls.LOCAL_STORE_PATH, exist_ok=True)
        # Download the file
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            with open(local_file_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        logger.info("File downloaded successfully")

    @classmethod
    def task_download_llamacloud_pipeline_file(
        cls,
        file_name: str,
        pipeline_id: str,
        force_download: bool = False,
    ) -> Optional[str]:
        # Check is the file already exists
        downloaded_file_path = cls.get_file_path(file_name, pipeline_id)
        if os.path.exists(downloaded_file_path) and not force_download:
            logger.debug(f"File {file_name} already exists in local storage")
            return
        try:
            logger.info(f"Downloading file {file_name} for pipeline {pipeline_id}")
            files = cls.get_files(pipeline_id)
            if not files or not isinstance(files, list):
                raise Exception("No files found in LlamaCloud")
            for file in files:
                if file["name"] == file_name:
                    file_id = file["file_id"]
                    project_id = file["project_id"]
                    file_detail = cls.get_file_detail(project_id, file_id)
                    local_file_url = cls.download_file(
                        file_detail["url"], downloaded_file_path
                    )
                    break
        except Exception as error:
            logger.info(f"Error fetching file from LlamaCloud: {error}")

    @classmethod
    def get_file_name(cls, name: str, pipeline_id: str) -> str:
        return cls.DOWNLOAD_FILE_NAME_TPL.format(pipeline_id=pipeline_id, filename=name)

    @classmethod
    def get_file_path(cls, name: str, pipeline_id: str) -> str:
        return os.path.join(cls.LOCAL_STORE_PATH, cls.get_file_name(name, pipeline_id))

    @staticmethod
    def make_request(
        url: str, data=None, headers: Optional[Dict] = None, method: str = "get"
    ):
        if headers is None:
            headers = {
                "Accept": "application/json",
                "Authorization": f'Bearer {os.getenv("LLAMA_CLOUD_API_KEY")}',
            }
        response = requests.request(method, url, headers=headers, data=data)
        response.raise_for_status()
        return response.json()
