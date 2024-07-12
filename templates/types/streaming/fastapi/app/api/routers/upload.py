import logging
from typing import List
from pydantic import BaseModel
from fastapi import HTTPException
from fastapi import APIRouter
from app.api.controllers.file import FileController

file_upload_router = r = APIRouter()

logger = logging.getLogger("uvicorn")


class FileUploadRequest(BaseModel):
    base64: str


@r.post("")
def upload_file(request: FileUploadRequest) -> List[str]:
    try:
        logger.info("Processing file")
        return FileController.process_file(request.base64)
    except Exception as e:
        logger.error(f"Error processing file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error processing file")
