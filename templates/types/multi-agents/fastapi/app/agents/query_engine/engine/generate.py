from dotenv import load_dotenv

load_dotenv()

import os
import logging
from llama_index.core.indices import (
    VectorStoreIndex,
)
from app.settings import init_settings
from app.agents.query_engine.engine.loader import FileLoaderConfig, get_file_documents


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    init_settings()
    logger.info("Creating new index")
    storage_dir = os.environ.get("STORAGE_DIR", "storage")
    documents = get_file_documents(
        FileLoaderConfig(
            data_dir="data",
            use_llama_parse=os.getenv("USE_LLAMA_PARSE", False),
        )
    )
    index = VectorStoreIndex.from_documents(
        documents,
    )
    # store it for later
    index.storage_context.persist(storage_dir)
    logger.info(f"Finished creating new index. Stored in {storage_dir}")


if __name__ == "__main__":
    generate_datasource()
