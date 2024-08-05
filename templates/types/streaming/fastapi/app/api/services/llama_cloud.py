import logging
import os
from typing import Any, Dict, List, Optional

import requests
from app.api.routers.models import LlamaCloudFile

logger = logging.getLogger("uvicorn")


class LLamaCloudFileService:
    LLAMA_CLOUD_URL = "https://cloud.llamaindex.ai/api/v1"
    LOCAL_STORE_PATH = "output/llamacloud"

    DOWNLOAD_FILE_NAME_TPL = "{pipeline_id}${filename}"

    @classmethod
    def get_all_projects(cls) -> List[Dict[str, Any]]:
        url = f"{cls.LLAMA_CLOUD_URL}/projects"
        return cls._make_request(url)
    
    @classmethod
    def get_all_pipelines(cls) -> List[Dict[str, Any]]:
        url = f"{cls.LLAMA_CLOUD_URL}/pipelines"
        return cls._make_request(url)
    
    @classmethod
    def get_all_projects_with_pipelines(cls) -> List[Dict[str, Any]]:
        try:
            projects = cls.get_all_projects()
            pipelines = cls.get_all_pipelines()
            return [
                {
                    **project,
                    "pipelines": [p for p in pipelines if p["project_id"] == project["id"]],
                }
                for project in projects
            ]
        except Exception as error:
            logger.error(f"Error listing projects and pipelines: {error}")
            return []

    @classmethod
    def _get_files(cls, pipeline_id: str) -> List[Dict[str, Any]]:
        url = f"{cls.LLAMA_CLOUD_URL}/pipelines/{pipeline_id}/files"
        return cls._make_request(url)

    @classmethod
    def _get_file_detail(cls, project_id: str, file_id: str) -> Dict[str, Any]:
        url = f"{cls.LLAMA_CLOUD_URL}/files/{file_id}/content?project_id={project_id}"
        return cls._make_request(url)

    @classmethod
    def _download_file(cls, url: str, local_file_path: str):
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
    def download_llamacloud_pipeline_file(
        cls,
        file: LlamaCloudFile,
        force_download: bool = False,
    ):
        file_name = file.file_name
        pipeline_id = file.pipeline_id

        # Check is the file already exists
        downloaded_file_path = cls.get_file_path(file_name, pipeline_id)
        if os.path.exists(downloaded_file_path) and not force_download:
            logger.debug(f"File {file_name} already exists in local storage")
            return
        try:
            logger.info(f"Downloading file {file_name} for pipeline {pipeline_id}")
            files = cls._get_files(pipeline_id)
            if not files or not isinstance(files, list):
                raise Exception("No files found in LlamaCloud")
            for file_entry in files:
                if file_entry["name"] == file_name:
                    file_id = file_entry["file_id"]
                    project_id = file_entry["project_id"]
                    file_detail = cls._get_file_detail(project_id, file_id)
                    cls._download_file(file_detail["url"], downloaded_file_path)
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
    def _make_request(
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
