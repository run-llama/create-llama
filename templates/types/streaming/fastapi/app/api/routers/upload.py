import logging
import uuid
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.services.file import PrivateFileService

file_upload_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


class FileUploadRequest(BaseModel):
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        description="The session id (optional, if not provided, a new session will be created)",
    )
    base64: str
    filename: str
    params: Any = None


@r.post("")
def upload_file(request: FileUploadRequest) -> Dict[str, Any]:
    try:
        logger.info(f"Processing file for session {request.id}")
        file_meta = PrivateFileService.process_file(
            request.filename, request.base64, request.params
        )
        return file_meta.to_upload_response()
    except Exception as e:
        logger.error(f"Error processing file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing file")
