import os
import base64
import tempfile
from typing import List, Dict
from pathlib import Path
from llama_index.core import SimpleDirectoryReader
from llama_index.core import VectorStoreIndex
from llama_index.core.readers.file.base import (
    _try_loading_included_file_formats as get_file_loaders_map,
    default_file_metadata_func,
)
from llama_index.core.ingestion import IngestionPipeline
from app.engine.index import get_index

MINE_TYPE_EXTENSION_MAP = {
    "application/pdf": "pdf",
    "application/x-t602": "602",
    "application/x-abiword": "zabw",
    "image/cgm": "cgm",
    "application/x-cwk": "cwk",
    "application/msword": "dot",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-word.document.macroEnabled.12": "docm",
    "application/vnd.ms-word.template.macroEnabled.12": "dotm",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.template": "dotx",
    "application/x-hwp": "hwp",
    "application/x-iwork-keynote-sffkey": "key",
    "application/vnd.lotus-wordpro": "lwp",
    "application/macwriteii": "mcw",
    "application/x-iwork-pages-sffpages": "pages",
    "application/x-pagemaker": "pbd",
    "application/vnd.ms-powerpoint": "pot",
    "application/vnd.ms-powerpoint.presentation.macroEnabled.12": "pptm",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-powerpoint.template.macroEnabled.12": "potm",
    "application/vnd.openxmlformats-officedocument.presentationml.template": "potx",
    "application/rtf": "rtf",
    "application/vnd.stardivision.draw": "sda",
    "application/vnd.stardivision.impress": "sdd",
    "application/sdp": "sdp",
    "application/vnd.stardivision.writer": "vor",
    "application/vnd.sun.xml.impress.template": "sti",
    "application/vnd.sun.xml.impress": "sxi",
    "application/vnd.sun.xml.writer": "sxw",
    "application/vnd.sun.xml.writer.template": "stw",
    "application/vnd.sun.xml.writer.global": "sxg",
    "text/plain": "txt",
    "application/vnd.uoml+xml": "uos2",
    "application/vnd.openofficeorg.presentation": "uop",
    "application/x-uo": "uot",
    "application/wordperfect": "wpd",
    "application/vnd.ms-works": "xlr",
    "application/xml": "xml",
    "application/epub+zip": "epub",
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
    "image/tiff": "tiff",
    "image/webp": "webp",
    "text/html": "html",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-excel": "et",
    "application/vnd.ms-excel.sheet.macroEnabled.12": "xlsm",
    "application/vnd.ms-excel.sheet.binary.macroEnabled.12": "xlsb",
    "text/csv": "csv",
    "application/x-dif": "dif",
    "text/vnd.sylk": "slk",
    "application/x-prn": "prn",
    "application/x-iwork-numbers-sffnumbers": "numbers",
    "application/vnd.oasis.opendocument.spreadsheet": "fods",
    "application/vnd.dbf": "dbf",
    "application/vnd.lotus-1-2-3": "123",
    "application/x-lotus": "wq2",
    "application/x-quattro-pro": "qpw",
    "application/ethos": "eth",
    "text/tab-separated-values": "tsv",
}


def file_metadata_func(*args, **kwargs) -> Dict:
    default_meta = default_file_metadata_func(*args, **kwargs)
    default_meta["private"] = "true"
    return default_meta


class FileController:

    @staticmethod
    def preprocess_base64_file(base64_content: str) -> tuple:
        header, data = base64_content.split(",", 1)
        mine_type = header.split(";")[0].split(":", 1)[1]
        extension = MINE_TYPE_EXTENSION_MAP.get(mine_type)
        # File data as bytes
        data = base64.b64decode(data)
        return data, extension

    @staticmethod
    def load_file(file_data, extension) -> List["Documents"]:
        # Create a temp file with extensions
        # TODO: We should store the file to serve it in file viewer
        with tempfile.NamedTemporaryFile(
            suffix=f".{extension}", delete=False
        ) as temp_file:
            temp_file.write(file_data)
            temp_file_path = Path(temp_file.name)
            # The custom file extractor must be instantiated
            file_extractor = {
                ext: loader_cls() for ext, loader_cls in get_file_loaders_map().items()
            }
            documents = SimpleDirectoryReader.load_file(
                input_file=temp_file_path,
                file_metadata=file_metadata_func,
                file_extractor=file_extractor,
                raise_on_error=True,
            )

            return documents

    @staticmethod
    def process_file(base64_content: str) -> List[str]:
        file_data, extension = FileController.preprocess_base64_file(base64_content)
        documents = FileController.load_file(file_data, extension)

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
