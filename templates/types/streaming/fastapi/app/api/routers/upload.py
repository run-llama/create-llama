import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.services.file import PrivateFileService
from app.engine.utils.file_helper import FileMetadata

file_upload_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


class FileUploadRequest(BaseModel):
    base64: str
    filename: str
    filesize: Optional[int] = None
    filetype: Optional[str] = None
    params: Any = None


class DocumentFileResponse(BaseModel):
    id: str
    filename: str
    filesize: Optional[int] = None
    filetype: Optional[str] = None
    metadata: FileMetadata


@r.post("")
def upload_file(request: FileUploadRequest) -> DocumentFileResponse:
    """
    To upload a private file from the chat UI.
    """
    try:
        logger.info(f"Processing file: {request.filename}")
        file_meta = PrivateFileService.process_file(
            request.filename, request.base64, request.params
        )

        document_file = DocumentFileResponse(
            id=file_meta.id,
            metadata=file_meta,
            # Still return the original fields of the request to display in the chat UI.
            filename=request.filename,
            filesize=request.filesize,
            filetype=request.filetype,
        )
        return document_file
    except Exception as e:
        logger.error(f"Error processing file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing file")
