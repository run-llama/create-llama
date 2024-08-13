from io import BytesIO
import logging
import os
import time
from typing import Any, Dict, List

from llama_cloud import ManagedIngestionStatus
import requests
from app.api.routers.models import LlamaCloudFile
from app.engine.index import get_client


logger = logging.getLogger("uvicorn")


class LLamaCloudFileService:
    LOCAL_STORE_PATH = "output/llamacloud"
    DOWNLOAD_FILE_NAME_TPL = "{pipeline_id}${filename}"

    @classmethod
    def get_all_projects_with_pipelines(cls) -> List[Dict[str, Any]]:
        try:
            client = get_client()
            projects = client.projects.list_projects()
            pipelines = client.pipelines.search_pipelines()
            return [
                {
                    **(project.dict()),
                    "pipelines": [
                        {"id": p.id, "name": p.name}
                        for p in pipelines
                        if p.project_id == project.id
                    ],
                }
                for project in projects
            ]
        except Exception as error:
            logger.error(f"Error listing projects and pipelines: {error}")
            return []

    @classmethod
    def add_file_to_pipeline(
        cls,
        pipeline_id: str,
        file_name: str,
        file_data: bytes,
    ) -> str:
        client = get_client()
        upload_file = (file_name, BytesIO(file_data))
        file = client.files.upload_file(upload_file=upload_file)
        files = [
            {
                "file_id": file.id,
                "custom_metadata": {
                    "private": "true",
                    "file_id": file.id,
                },
            }
        ]
        files = client.pipelines.add_files_to_pipeline(pipeline_id, request=files)

        # Wait 2s for the file to be processed
        max_attempts = 20
        attempt = 0
        while attempt < max_attempts:
            result = client.pipelines.get_pipeline_file_status(pipeline_id, file.id)
            if result.status == ManagedIngestionStatus.ERROR:
                raise Exception(f"File processing failed: {str(result)}")
            if result.status == ManagedIngestionStatus.SUCCESS:
                # File is ingested - return the file id
                return file.id
            attempt += 1
            time.sleep(0.1)  # Sleep for 100ms
        raise Exception(
            f"File processing did not complete after {max_attempts} attempts."
        )

    @classmethod
    def download_pipeline_file(
        cls,
        file: LlamaCloudFile,
        force_download: bool = False,
    ):
        client = get_client()
        file_name = file.file_name
        pipeline_id = file.pipeline_id

        # Check is the file already exists
        downloaded_file_path = cls._get_file_path(file_name, pipeline_id)
        if os.path.exists(downloaded_file_path) and not force_download:
            logger.debug(f"File {file_name} already exists in local storage")
            return
        try:
            logger.info(f"Downloading file {file_name} for pipeline {pipeline_id}")
            files = client.pipelines.list_pipeline_files(pipeline_id)
            if not files or not isinstance(files, list):
                raise Exception("No files found in LlamaCloud")
            for file_entry in files:
                if file_entry.name == file_name:
                    file_id = file_entry.file_id
                    project_id = file_entry.project_id
                    file_detail = client.files.read_file_content(
                        file_id, project_id=project_id
                    )
                    cls._download_file(file_detail.url, downloaded_file_path)
                    break
        except Exception as error:
            logger.info(f"Error fetching file from LlamaCloud: {error}")

    @classmethod
    def _get_file_name(cls, name: str, pipeline_id: str) -> str:
        return cls.DOWNLOAD_FILE_NAME_TPL.format(pipeline_id=pipeline_id, filename=name)

    @classmethod
    def _get_file_path(cls, name: str, pipeline_id: str) -> str:
        return os.path.join(cls.LOCAL_STORE_PATH, cls._get_file_name(name, pipeline_id))

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
