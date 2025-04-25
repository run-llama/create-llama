import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.routers.models import DocumentFile
from app.services.file import FileService

file_upload_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


class FileUploadRequest(BaseModel):
    base64: str
    name: str
    params: Any = None


@r.post("")
def upload_file(request: FileUploadRequest) -> DocumentFile:
    """
    To upload a private file from the chat UI.
    """
    try:
        logger.info(f"Processing file: {request.name}")
        return FileService.process_private_file(
            request.name, request.base64, request.params
        )
    except Exception as e:
        logger.error(f"Error processing file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing file")
