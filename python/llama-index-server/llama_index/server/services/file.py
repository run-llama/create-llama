import base64
import logging
import mimetypes
import os
import re
import uuid
from pathlib import Path
from typing import Optional, Tuple, Union

from llama_index.server.models.chat import ServerFile
from llama_index.server.settings import server_settings

logger = logging.getLogger(__name__)

PRIVATE_STORE_PATH = str(Path("output", "private"))


class FileService:
    """
    Store files to server
    """

    @classmethod
    def save_file(
        cls,
        content: Union[bytes, str],
        file_name: str,
        save_dir: Optional[str] = None,
    ) -> ServerFile:
        """
        Save the content to a file in the local file server (accessible via URL).

        Args:
            content (bytes | str): The content to save, either bytes or string.
            file_name (str): The original name of the file.
            save_dir (Optional[str]): The path to store the file. Defaults is set to PRIVATE_STORE_PATH (output/private) if not provided.
        Returns:
            The metadata of the saved file.
        """
        if save_dir is None:
            save_dir = os.path.join("output", "private")

        file_id, extension = cls._process_file_name(file_name)
        file_path = os.path.join(save_dir, file_id)

        # Write the file directly, handling both str and bytes
        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as f:
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
        file_url = cls._get_file_url(file_id, save_dir)
        return ServerFile(
            id=file_id,
            type=extension,
            size=file_size,
            url=file_url,
            path=file_path,
        )

    @classmethod
    def _process_file_name(cls, file_name: str) -> tuple[str, str]:
        """
        Process original file name to generate a unique file id and extension.
        """
        _id = str(uuid.uuid4())
        name, extension = os.path.splitext(file_name)
        extension = extension.lstrip(".")
        if extension == "":
            raise ValueError("File name is not valid! It must have an extension.")
        # sanitize the name
        name = re.sub(r"[^a-zA-Z0-9.]", "_", name)
        file_id = f"{name}_{_id}.{extension}"
        return file_id, extension

    @classmethod
    def _get_file_url(cls, file_id: str, save_dir: Optional[str] = None) -> str:
        """
        Get the URL of a file.
        """
        if save_dir is None:
            save_dir = os.path.join("output", "private")
        # Ensure the path uses forward slashes for URLs
        url_path = f"{save_dir}/{file_id}".replace("\\", "/")
        return f"{server_settings.file_server_url_prefix}/{url_path}"

    @classmethod
    def get_private_file_path(cls, file_id: str) -> str:
        """
        Get the path of a private file. (the file must be stored in default store path)
        """
        return os.path.join(PRIVATE_STORE_PATH, file_id)

    @staticmethod
    def _preprocess_base64_file(base64_content: str) -> Tuple[bytes, str]:
        header, data = base64_content.split(",", 1)
        mime_type = header.split(";")[0].split(":", 1)[1]
        extension = mimetypes.guess_extension(mime_type)
        if extension is None:
            raise ValueError(f"Unsupported file type: {mime_type}")
        extension = extension.lstrip(".")
        return base64.b64decode(data), extension
