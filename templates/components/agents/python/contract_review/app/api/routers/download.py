import os

from fastapi import APIRouter
from fastapi.responses import FileResponse

router = APIRouter()


@router.get("")
def download_file(path: str):
    # Sanitize path to prevent directory traversal
    path = path.replace("..", "")

    # Construct full file path
    file_path = path if path.startswith("output") else f"output/{path}"

    # Check if file exists before returning
    if not os.path.exists(file_path):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=file_path,
    )
