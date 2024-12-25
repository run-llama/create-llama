import base64
import logging
import mimetypes
import os
import re
import uuid
from io import BytesIO
from pathlib import Path
from typing import List, Optional, Tuple

from llama_index.core import VectorStoreIndex
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.readers.file.base import (
    _try_loading_included_file_formats as get_file_loaders_map,
)
from llama_index.core.schema import Document
from llama_index.indices.managed.llama_cloud.base import LlamaCloudIndex
from llama_index.readers.file import FlatReader
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

PRIVATE_STORE_PATH = str(Path("output", "uploaded"))
TOOL_STORE_PATH = str(Path("output", "tools"))
LLAMA_CLOUD_STORE_PATH = str(Path("output", "llamacloud"))


class DocumentFile(BaseModel):
    id: str
    name: str  # Stored file name
    type: str = None
    size: int = None
    url: str = None
    path: Optional[str] = Field(
        None,
        description="The stored file path. Used internally in the server.",
        exclude=True,
    )
    refs: Optional[List[str]] = Field(
        None, description="The document ids in the index."
    )


class FileService:
    """
    To store the files uploaded by the user and add them to the index.
    """

    @classmethod
    def process_private_file(
        cls,
        file_name: str,
        base64_content: str,
        params: Optional[dict] = None,
    ) -> DocumentFile:
        """
        Store the uploaded file and index it if necessary.
        """
        try:
            from app.engine.index import IndexConfig, get_index
        except ImportError as e:
            raise ValueError("IndexConfig or get_index is not found") from e

        if params is None:
            params = {}

        # Add the nodes to the index and persist it
        index_config = IndexConfig(**params)
        index = get_index(index_config)

        # Preprocess and store the file
        file_data, extension = cls._preprocess_base64_file(base64_content)

        document_file = cls.save_file(
            file_data,
            file_name=file_name,
            save_dir=PRIVATE_STORE_PATH,
        )

        # Don't index csv files (they are handled by tools)
        if extension == "csv":
            return document_file
        else:
            # Insert the file into the index and update document ids to the file metadata
            if isinstance(index, LlamaCloudIndex):
                doc_id = cls._add_file_to_llama_cloud_index(
                    index, document_file.name, file_data
                )
                # Add document ids to the file metadata
                document_file.refs = [doc_id]
            else:
                documents = cls._load_file_to_documents(document_file)
                cls._add_documents_to_vector_store_index(documents, index)
                # Add document ids to the file metadata
                document_file.refs = [doc.doc_id for doc in documents]

        # Return the file metadata
        return document_file

    @classmethod
    def save_file(
        cls,
        content: bytes | str,
        file_name: str,
        save_dir: Optional[str] = None,
    ) -> DocumentFile:
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
            save_dir = os.path.join("output", "uploaded")

        file_id = str(uuid.uuid4())
        name, extension = os.path.splitext(file_name)
        extension = extension.lstrip(".")
        sanitized_name = _sanitize_file_name(name)
        if extension == "":
            raise ValueError("File is not supported!")
        new_file_name = f"{sanitized_name}_{file_id}.{extension}"

        file_path = os.path.join(save_dir, new_file_name)

        if isinstance(content, str):
            content = content.encode()

        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as file:
                file.write(content)
        except PermissionError as e:
            logger.error(
                f"Permission denied when writing to file {file_path}: {str(e)}"
            )
            raise
        except IOError as e:
            logger.error(
                f"IO error occurred when writing to file {file_path}: {str(e)}"
            )
            raise
        except Exception as e:
            logger.error(f"Unexpected error when writing to file {file_path}: {str(e)}")
            raise

        logger.info(f"Saved file to {file_path}")

        file_url_prefix = os.getenv("FILESERVER_URL_PREFIX")
        if file_url_prefix is None:
            logger.warning(
                "FILESERVER_URL_PREFIX is not set, fallback to http://localhost:8000/api/files"
            )
            file_url_prefix = "http://localhost:8000/api/files"
        file_size = os.path.getsize(file_path)

        file_url = os.path.join(
            file_url_prefix,
            save_dir,
            new_file_name,
        )

        return DocumentFile(
            id=file_id,
            name=new_file_name,
            type=extension,
            size=file_size,
            path=file_path,
            url=file_url,
            refs=None,
        )

    @staticmethod
    def _preprocess_base64_file(base64_content: str) -> Tuple[bytes, str | None]:
        header, data = base64_content.split(",", 1)
        mime_type = header.split(";")[0].split(":", 1)[1]
        extension = mimetypes.guess_extension(mime_type).lstrip(".")
        # File data as bytes
        return base64.b64decode(data), extension

    @staticmethod
    def _load_file_to_documents(file: DocumentFile) -> List[Document]:
        """
        Load the file from the private directory and return the documents
        """
        _, extension = os.path.splitext(file.name)
        extension = extension.lstrip(".")

        # Load file to documents
        # If LlamaParse is enabled, use it to parse the file
        # Otherwise, use the default file loaders
        reader = _get_llamaparse_parser()
        if reader is None:
            reader_cls = _default_file_loaders_map().get(f".{extension}")
            if reader_cls is None:
                raise ValueError(f"File extension {extension} is not supported")
            reader = reader_cls()
        if file.path is None:
            raise ValueError("Document file path is not set")
        documents = reader.load_data(Path(file.path))
        # Add custom metadata
        for doc in documents:
            doc.metadata["file_name"] = file.name
            doc.metadata["private"] = "true"
        return documents

    @staticmethod
    def _add_documents_to_vector_store_index(
        documents: List[Document], index: VectorStoreIndex
    ) -> None:
        """
        Add the documents to the vector store index
        """
        pipeline = IngestionPipeline()
        nodes = pipeline.run(documents=documents)

        # Add the nodes to the index and persist it
        if index is None:
            index = VectorStoreIndex(nodes=nodes)
        else:
            index.insert_nodes(nodes=nodes)
        index.storage_context.persist(
            persist_dir=os.environ.get("STORAGE_DIR", "storage")
        )

    @staticmethod
    def _add_file_to_llama_cloud_index(
        index: LlamaCloudIndex,
        file_name: str,
        file_data: bytes,
    ) -> str:
        """
        Add the file to the LlamaCloud index.
        LlamaCloudIndex is a managed index so we can directly use the files.
        """
        try:
            from app.engine.service import LLamaCloudFileService  # type: ignore
        except ImportError as e:
            raise ValueError("LlamaCloudFileService is not found") from e

        # LlamaCloudIndex is a managed index so we can directly use the files
        upload_file = (file_name, BytesIO(file_data))
        doc_id = LLamaCloudFileService.add_file_to_pipeline(
            index.project.id,
            index.pipeline.id,
            upload_file,
            custom_metadata={},
            wait_for_processing=True,
        )
        return doc_id


def _sanitize_file_name(file_name: str) -> str:
    """
    Sanitize the file name by replacing all non-alphanumeric characters with underscores
    """
    sanitized_name = re.sub(r"[^a-zA-Z0-9.]", "_", file_name)
    return sanitized_name


def _get_llamaparse_parser():
    from app.engine.loaders import load_configs
    from app.engine.loaders.file import FileLoaderConfig, llama_parse_parser

    config = load_configs()
    file_loader_config = FileLoaderConfig(**config["file"])
    if file_loader_config.use_llama_parse:
        return llama_parse_parser()
    else:
        return None


def _default_file_loaders_map():
    default_loaders = get_file_loaders_map()
    default_loaders[".txt"] = FlatReader
    default_loaders[".csv"] = FlatReader
    return default_loaders
