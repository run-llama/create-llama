import os
import base64
import mimetypes
from uuid import uuid4
from pathlib import Path
from typing import List, Dict
from llama_index.core import VectorStoreIndex
from llama_index.readers.file import FlatReader
from llama_index.core.readers.file.base import (
    _try_loading_included_file_formats as get_file_loaders_map,
    default_file_metadata_func,
)
from llama_index.core.schema import Document
from llama_index.core.ingestion import IngestionPipeline
from app.engine.index import get_index



def file_metadata_func(*args, **kwargs) -> Dict:
    default_meta = default_file_metadata_func(*args, **kwargs)
    default_meta["private"] = "true"
    return default_meta

def file_loaders_map():
    default_loaders = get_file_loaders_map()
    default_loaders[".txt"] = FlatReader
    return default_loaders



class FileController:

    PRIVATE_STORE_PATH="output/uploaded"

    @staticmethod
    def preprocess_base64_file(base64_content: str) -> tuple:
        header, data = base64_content.split(",", 1)
        mime_type = header.split(";")[0].split(":", 1)[1]
        extension = mimetypes.guess_extension(mime_type)
        # File data as bytes
        data = base64.b64decode(data)
        return data, extension

    @staticmethod
    def store_and_parse_file(file_data, extension) -> List[Document]:
        # Store file to the private directory
        os.makedirs(FileController.PRIVATE_STORE_PATH, exist_ok=True)

        # random file name
        file_name = f"{uuid4().hex}{extension}"
        file_path = Path(os.path.join(FileController.PRIVATE_STORE_PATH, file_name))

        # write file
        with open(file_path, "wb") as f:
            f.write(file_data)

        # Load file to documents
        reader_cls = file_loaders_map().get(extension)
        if reader_cls is None:
            raise ValueError(f"File extension {extension} is not supported")
        documents = reader_cls().load_data(file_path)
        # Add custom metadata
        for doc in documents:
            doc.metadata["private"] = "true"
        return documents

    @staticmethod
    def process_file(base64_content: str) -> List[str]:
        file_data, extension = FileController.preprocess_base64_file(base64_content)
        documents = FileController.store_and_parse_file(file_data, extension)

        # Only process nodes, no store the index
        pipeline = IngestionPipeline()
        nodes = pipeline.run(documents=documents)

        # Add the nodes to the index and persist it
        current_index = get_index()
        if current_index is None:
            current_index = VectorStoreIndex(nodes=nodes)
        else:
            current_index.insert_nodes(nodes=nodes)
        current_index.storage_context.persist(
            persist_dir=os.environ.get("STORAGE_DIR", "storage")
        )

        # Return the document ids
        return [doc.doc_id for doc in documents]
