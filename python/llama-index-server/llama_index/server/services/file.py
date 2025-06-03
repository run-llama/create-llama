import logging
import os
import re
import uuid
from pathlib import Path
from typing import List, Optional, Union

from pydantic import BaseModel, Field

from llama_index.server.settings import server_settings

logger = logging.getLogger(__name__)

PRIVATE_STORE_PATH = str(Path("output", "private"))
TOOL_STORE_PATH = str(Path("output", "tools"))
LLAMA_CLOUD_STORE_PATH = str(Path("output", "llamacloud"))


class PrivateFile(BaseModel):
    id: str
    name: str
    type: Optional[str] = None
    size: Optional[int] = None
    url: Optional[str] = None
    path: Optional[str] = Field(
        None,
        description="The stored file path. Used internally in the server.",
        exclude=True,
    )


class DocumentFile(PrivateFile):
    refs: Optional[List[str]] = Field(
        None, description="The document ids in the index."
    )


class FileService:
    """
    Stores files uploaded by the user.
    """

    @classmethod
    def save_file(
        cls,
        content: Union[bytes, str],
        file_name: str,
        save_dir: Optional[str] = None,
    ) -> PrivateFile:
        """
        Save the content to a file in the local file server (accessible via URL).

        Args:
            content (bytes | str): The content to save, either bytes or string.
            file_name (str): The original name of the file.
            save_dir (Optional[str]): The relative path from the current working directory. Defaults to the `output/uploaded` directory.

        Returns:
            The metadata of the saved file.
        """
        if save_dir is None:
            save_dir = os.path.join("output", "private")

        file_id, new_file_name, extension = cls._generate_file_name(file_name)
        file_path = os.path.join(save_dir, new_file_name)

        # Write the file directly, handling both str and bytes
        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            mode = "wb"
            with open(file_path, mode) as f:
                if isinstance(content, str):
                    f.write(content.encode())
                else:
                    f.write(content)
        except PermissionError as e:
            logger.error(f"Permission denied when writing to file {file_path}: {e!s}")
            raise
        except OSError as e:
            logger.error(f"IO error occurred when writing to file {file_path}: {e!s}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error when writing to file {file_path}: {e!s}")
            raise

        logger.info(f"Saved file to {file_path}")

        file_size = os.path.getsize(file_path)
        file_url = cls.get_file_url(new_file_name, save_dir)
        return PrivateFile(
            id=file_id,
            name=new_file_name,
            type=extension,
            size=file_size,
            url=file_url,
            path=file_path,
        )

    @staticmethod
    def _generate_file_name(file_name: str) -> tuple[str, str, str]:
        """
        Generate a unique file name using a UUID and sanitize the original name.

        Returns:
            Tuple of (file_id, new_file_name, extension)
        """
        file_id = str(uuid.uuid4())
        name, extension = os.path.splitext(file_name)
        extension = extension.lstrip(".")
        if extension == "":
            raise ValueError("File type is not supported!")
        sanitized_name = re.sub(r"[^a-zA-Z0-9.]", "_", name)
        new_file_name = f"{sanitized_name}_{file_id}.{extension}"
        return file_id, new_file_name, extension

    @classmethod
    def get_file_url(cls, file_name: str, save_dir: Optional[str] = None) -> str:
        """
        Get the URL of a file.
        """
        if save_dir is None:
            save_dir = os.path.join("output", "private")
        # Ensure the path uses forward slashes for URLs
        url_path = f"{save_dir}/{file_name}".replace("\\", "/")
        return f"{server_settings.file_server_url_prefix}/{url_path}"
