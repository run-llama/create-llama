import logging
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.services.file import PrivateFileService

file_upload_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


class FileUploadRequest(BaseModel):
    base64: str


@r.post("")
def upload_file(request: FileUploadRequest) -> List[str]:
    try:
        logger.info("Processing file")
        return PrivateFileService.process_file(request.base64)
    except Exception as e:
        logger.error(f"Error processing file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing file")
