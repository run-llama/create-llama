import logging
import os
import re
import uuid
from typing import List, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class FileMetadata(BaseModel):
    id: str = Field(..., description="The ID of the file")
    name: str = Field(..., description="The name of the file")
    url: str = Field(..., description="The URL of the file")
    path: Optional[str] = Field(
        None,
        description="The stored path of the file. It'll be excluded from the request",
        exclude=True,
    )
    refs: Optional[List[str]] = Field(
        None, description="The indexed document IDs that the file is referenced to"
    )


def save_file(
    content: bytes | str,
    file_name: str,
    save_dir: Optional[str] = None,
) -> FileMetadata:
    """
    Save the content to a file in the local file server (accessible via URL)
    Args:
        content (bytes | str): The content to save, either bytes or string.
        file_name (str): The original name of the file.
        save_dir (Optional[str]): The relative path from the current working directory. Defaults to the `output/uploaded` directory.
    Returns:
        The metadata of the saved file.
    """
    if save_dir is None:
        save_dir = os.path.join(os.getcwd(), "output/uploaded")

    file_id = str(uuid.uuid4())
    new_file_name = f"{file_id}_{_sanitize_file_name(file_name)}"

    file_path = os.path.join(save_dir, new_file_name)

    if isinstance(content, str):
        content = content.encode()

    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, "wb") as file:
            file.write(content)
    except PermissionError as e:
        logger.error(f"Permission denied when writing to file {file_path}: {str(e)}")
        raise
    except IOError as e:
        logger.error(f"IO error occurred when writing to file {file_path}: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error when writing to file {file_path}: {str(e)}")
        raise

    logger.info(f"Saved file to {file_path}")

    return FileMetadata(
        id=file_id,
        name=new_file_name,
        path=file_path,
        url=f"{os.getenv('FILESERVER_URL_PREFIX')}/{file_path}",
        refs=None,
    )


def _sanitize_file_name(file_name: str) -> str:
    """
    Sanitize the file name by replacing all non-alphanumeric characters with underscores
    """
    name, ext = os.path.splitext(file_name)
    return re.sub(r"[^a-zA-Z0-9]", "_", name) + ext
