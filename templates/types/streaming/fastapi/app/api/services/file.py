import base64
import mimetypes
import os
from io import BytesIO
from pathlib import Path
import time
from typing import Any, Dict, List, Tuple
from uuid import uuid4


from app.engine.index import get_index
from llama_index.core import VectorStoreIndex
from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.readers.file.base import (
    _try_loading_included_file_formats as get_file_loaders_map,
)
from llama_index.core.readers.file.base import default_file_metadata_func
from llama_index.core.schema import Document
from llama_index.indices.managed.llama_cloud.base import LlamaCloudIndex
from llama_index.readers.file import FlatReader

from app.api.services.llama_cloud import LLamaCloudFileService


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
    return default_loaders


class PrivateFileService:
    PRIVATE_STORE_PATH = "output/uploaded"

    @staticmethod
    def preprocess_base64_file(base64_content: str) -> Tuple[bytes, str | None]:
        header, data = base64_content.split(",", 1)
        mime_type = header.split(";")[0].split(":", 1)[1]
        extension = mimetypes.guess_extension(mime_type)
        # File data as bytes
        return base64.b64decode(data), extension

    @staticmethod
    def store_and_parse_file(file_data, extension) -> List[Document]:
        # Store file to the private directory
        os.makedirs(PrivateFileService.PRIVATE_STORE_PATH, exist_ok=True)

        # random file name
        file_name = f"{uuid4().hex}{extension}"
        file_path = Path(os.path.join(PrivateFileService.PRIVATE_STORE_PATH, file_name))

        # write file
        with open(file_path, "wb") as f:
            f.write(file_data)

        # Load file to documents
        # If LlamaParse is enabled, use it to parse the file
        # Otherwise, use the default file loaders
        reader = get_llamaparse_parser()
        if reader is None:
            reader_cls = default_file_loaders_map().get(extension)
            if reader_cls is None:
                raise ValueError(f"File extension {extension} is not supported")
            reader = reader_cls()
        documents = reader.load_data(file_path)
        # Add custom metadata
        for doc in documents:
            doc.metadata["file_name"] = file_name
            doc.metadata["private"] = "true"
        return documents

    @staticmethod
    def process_file(file_name: str, base64_content: str, params: Any) -> List[str]:
        file_data, extension = PrivateFileService.preprocess_base64_file(base64_content)

        # Add the nodes to the index and persist it
        current_index = get_index(params)

        # Insert the documents into the index
        if isinstance(current_index, LlamaCloudIndex):
            pipeline_id = current_index._get_pipeline_id()
            # LlamaCloudIndex is a managed index so we can directly use the files
            return [
                LLamaCloudFileService.add_file_to_pipeline(
                    pipeline_id, file_name, file_data
                )
            ]
        else:
            # First process documents into nodes
            documents = PrivateFileService.store_and_parse_file(file_data, extension)
            pipeline = IngestionPipeline()
            nodes = pipeline.run(documents=documents)

            # Add the nodes to the index and persist it
            if current_index is None:
                current_index = VectorStoreIndex(nodes=nodes)
            else:
                current_index.insert_nodes(nodes=nodes)
            current_index.storage_context.persist(
                persist_dir=os.environ.get("STORAGE_DIR", "storage")
            )

            # Return the document ids
            return [doc.doc_id for doc in documents]
