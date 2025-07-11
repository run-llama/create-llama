import logging
import os
import time
import typing
from io import BytesIO
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from llama_cloud import ManagedIngestionStatus, PipelineFileCreateCustomMetadataValue
from pydantic import BaseModel

from src.index import get_client

logger = logging.getLogger("uvicorn")


class LlamaCloudFile(BaseModel):
    file_name: str
    pipeline_id: str

    def __eq__(self, other):
        if not isinstance(other, LlamaCloudFile):
            return NotImplemented
        return (
            self.file_name == other.file_name and self.pipeline_id == other.pipeline_id
        )

    def __hash__(self):
        return hash((self.file_name, self.pipeline_id))


class LLamaCloudFileService:
    LOCAL_STORE_PATH = "output/llamacloud"
    DOWNLOAD_FILE_NAME_TPL = "{pipeline_id}${filename}"

    @classmethod
    def add_file_to_pipeline(
        cls,
        project_id: str,
        pipeline_id: str,
        upload_file: Union[typing.IO, Tuple[str, BytesIO]],
        custom_metadata: Optional[Dict[str, PipelineFileCreateCustomMetadataValue]],
        wait_for_processing: bool = True,
    ) -> str:
        client = get_client()
        file = client.files.upload_file(project_id=project_id, upload_file=upload_file)
        file_id = file.id
        files = [
            {
                "file_id": file_id,
                "custom_metadata": {"file_id": file_id, **(custom_metadata or {})},
            }
        ]
        files = client.pipelines.add_files_to_pipeline_api(pipeline_id, request=files)

        if not wait_for_processing:
            return file_id

        # Wait 2s for the file to be processed
        max_attempts = 20
        attempt = 0
        while attempt < max_attempts:
            result = client.pipelines.get_pipeline_file_status(
                file_id=file_id, pipeline_id=pipeline_id
            )
            if result.status == ManagedIngestionStatus.ERROR:
                raise Exception(f"File processing failed: {str(result)}")
            if result.status == ManagedIngestionStatus.SUCCESS:
                # File is ingested - return the file id
                return file_id
            attempt += 1
            time.sleep(0.1)  # Sleep for 100ms
        raise Exception(
            f"File processing did not complete after {max_attempts} attempts."
        )
