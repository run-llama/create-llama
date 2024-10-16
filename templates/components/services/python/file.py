import base64
import mimetypes
import os
import re
import uuid
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.engine.index import IndexConfig, get_index
from app.engine.utils.file_helper import FileMetadata, save_file
from llama_index.core import VectorStoreIndex
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.readers.file.base import (
    _try_loading_included_file_formats as get_file_loaders_map,
)
from llama_index.core.schema import Document
from llama_index.core.tools.function_tool import FunctionTool
from llama_index.indices.managed.llama_cloud.base import LlamaCloudIndex
from llama_index.readers.file import FlatReader


def get_llamaparse_parser():
    from app.engine.loaders import load_configs
    from app.engine.loaders.file import FileLoaderConfig, llama_parse_parser

    config = load_configs()
    file_loader_config = FileLoaderConfig(**config["file"])
    if file_loader_config.use_llama_parse:
        return llama_parse_parser()
    else:
        return None


def default_file_loaders_map():
    default_loaders = get_file_loaders_map()
    default_loaders[".txt"] = FlatReader
    default_loaders[".csv"] = FlatReader
    return default_loaders


class PrivateFileService:
    """
    To store the files uploaded by the user and add them to the index.
    """

    PRIVATE_STORE_PATH = "output/uploaded"

    @staticmethod
    def _preprocess_base64_file(base64_content: str) -> Tuple[bytes, str | None]:
        header, data = base64_content.split(",", 1)
        mime_type = header.split(";")[0].split(":", 1)[1]
        extension = mimetypes.guess_extension(mime_type)
        # File data as bytes
        return base64.b64decode(data), extension

    @staticmethod
    def _store_file(file_name, file_data) -> FileMetadata:
        """
        Store the file to the private directory and return the file metadata
        """
        # Store file to the private directory
        os.makedirs(PrivateFileService.PRIVATE_STORE_PATH, exist_ok=True)
        file_path = Path(os.path.join(PrivateFileService.PRIVATE_STORE_PATH, file_name))

        return save_file(file_data, file_path=str(file_path))

    @staticmethod
    def _load_file_to_documents(file_metadata: FileMetadata) -> List[Document]:
        """
        Load the file from the private directory and return the documents
        """
        _, extension = os.path.splitext(file_metadata.name)
        extension = extension.lstrip(".")

        # Load file to documents
        # If LlamaParse is enabled, use it to parse the file
        # Otherwise, use the default file loaders
        reader = get_llamaparse_parser()
        if reader is None:
            reader_cls = default_file_loaders_map().get(f".{extension}")
            if reader_cls is None:
                raise ValueError(f"File extension {extension} is not supported")
            reader = reader_cls()
        documents = reader.load_data(Path(file_metadata.path))
        # Add custom metadata
        for doc in documents:
            doc.metadata["file_name"] = file_metadata.name
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
            from app.engine.service import LLamaCloudFileService
        except ImportError:
            raise ValueError("LlamaCloudFileService is not found")

        project_id = index._get_project_id()
        pipeline_id = index._get_pipeline_id()
        # LlamaCloudIndex is a managed index so we can directly use the files
        upload_file = (file_name, BytesIO(file_data))
        doc_id = LLamaCloudFileService.add_file_to_pipeline(
            project_id,
            pipeline_id,
            upload_file,
            custom_metadata={},
        )
        return doc_id

    @staticmethod
    def _sanitize_file_name(file_name: str) -> str:
        file_name, extension = os.path.splitext(file_name)
        return re.sub(r"[^a-zA-Z0-9]", "_", file_name) + extension

    @classmethod
    def process_file(
        cls,
        file_name: str,
        base64_content: str,
        params: Optional[dict] = None,
    ) -> FileMetadata:
        if params is None:
            params = {}

        # Add the nodes to the index and persist it
        index_config = IndexConfig(**params)
        index = get_index(index_config)

        # Generate a new file name if the same file is uploaded multiple times
        file_id = str(uuid.uuid4())
        new_file_name = f"{file_id}_{cls._sanitize_file_name(file_name)}"

        # Preprocess and store the file
        file_data, extension = cls._preprocess_base64_file(base64_content)
        file_metadata = cls._store_file(new_file_name, file_data)

        tools = cls._get_available_tools()
        code_executor_tools = ["interpreter", "artifact"]
        # If the file is CSV and there is a code executor tool, we don't need to index.
        if extension == ".csv" and any(tool in tools for tool in code_executor_tools):
            return file_metadata
        else:
            # Insert the file into the index and update document ids to the file metadata
            if isinstance(index, LlamaCloudIndex):
                doc_id = cls._add_file_to_llama_cloud_index(
                    index, new_file_name, file_data
                )
                # Add document ids to the file metadata
                file_metadata.refs = [doc_id]
            else:
                documents = cls._load_file_to_documents(file_metadata)
                cls._add_documents_to_vector_store_index(documents, index)
                # Add document ids to the file metadata
                file_metadata.refs = [doc.doc_id for doc in documents]

        # Return the file metadata
        return file_metadata

    @staticmethod
    def _get_available_tools() -> Dict[str, List[FunctionTool]]:
        try:
            from app.engine.tools import ToolFactory

            tools = ToolFactory.from_env(map_result=True)
            return tools
        except ImportError:
            # There is no tool code
            return {}
        except Exception as e:
            raise ValueError(f"Failed to get available tools: {e}") from e
