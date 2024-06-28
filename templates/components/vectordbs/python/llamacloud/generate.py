from dotenv import load_dotenv

load_dotenv()

import os
import logging
from app.settings import init_settings
from app.engine.loaders import get_documents
from llama_index.indices.managed.llama_cloud import LlamaCloudIndex


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger()


def generate_datasource():
    init_settings()
    logger.info("Generate index for the provided data")

    name = os.getenv("LLAMA_CLOUD_NAME")
    project_name = os.getenv("LLAMA_CLOUD_PROJECT_NAME")
    api_key = os.getenv("LLAMA_CLOUD_API_KEY")
    base_url = os.getenv("LLAMA_CLOUD_BASE_URL")

    if not name or not project_name or not api_key:
        raise ValueError(
            "Please set LLAMA_CLOUD_NAME, LLAMA_CLOUD_PROJECT_NAME and LLAMA_CLOUD_API_KEY"
            " to your environment variables or config them in .env file"
        )

    documents = get_documents()

    LlamaCloudIndex.from_documents(
        documents,
        name,
        project_name=project_name,
        api_key=api_key,
        base_url=base_url,
    )

    logger.info("Finished generating the index")


if __name__ == "__main__":
    generate_datasource()
