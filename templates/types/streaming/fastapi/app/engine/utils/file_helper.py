import logging
import os
import uuid
from typing import Optional

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class FileMetadata(BaseModel):
    outputPath: str
    filename: str
    url: str


def save_file(
    content: bytes | str,
    file_name: Optional[str] = None,
    file_path: Optional[str] = None,
) -> FileMetadata:
    """
    Save the content to a file in the local file server (accessible via URL)
    Args:
        content (bytes | str): The content to save, either bytes or string.
        file_name (Optional[str]): The name of the file. If not provided, a random name will be generated with .txt extension.
        file_path (Optional[str]): The path to save the file to. If not provided, a random name will be generated.
    Returns:
        The metadata of the saved file.
    """
    if file_name is not None and file_path is not None:
        raise ValueError("Either file_name or file_path should be provided")

    if file_path is None:
        if file_name is None:
            file_name = f"{uuid.uuid4()}.txt"
        file_path = os.path.join(os.getcwd(), file_name)
    else:
        file_name = os.path.basename(file_path)

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
        outputPath=file_path,
        filename=file_name,
        url=f"{os.getenv('FILESERVER_URL_PREFIX')}/{file_path}",
    )
